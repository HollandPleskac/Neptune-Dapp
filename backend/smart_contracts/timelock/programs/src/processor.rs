use solana_program::{
    account_info::{next_account_info, AccountInfo},
    decode_error::DecodeError,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::PrintProgramError,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction::create_account,
    sysvar::{clock::Clock, Sysvar},
};
use std::convert::TryInto;
use num_traits::FromPrimitive;
use spl_token::{instruction::transfer, state::Account};
use core::cell::{RefMut};

use crate::{
    error::VestingError,
    instruction::{VestingInstruction},
    state::{
      pack_schedules_into_slice, 
      unpack_schedules, 
      VestingSchedule, 
      VestingScheduleHeader,
      DataHeader,
      Point,
      PointerAccountHeader,
      CalendarAccountHeader,
    },
};

pub struct Processor {}

pub const MAX_BOOST: f32 = 2.5;
//seconds in year * 4 years = seconds in 4 years: our max lock time. 
pub const MAX_LOCK_TIME: u64 = 31557600 * 4;

pub const SECONDS_IN_WEEK: u64 = 604800; //seconds in an epoch
pub const EPOCHS_IN_ERA: u16 = 26; //6 months
//epochs is number of weeks since unix zero time. Not Solana epochs
pub const ZERO_EPOCH: u16 = 2714; //1/6/22 0000 GMT. # of weeks since the unix zero time
pub const I128_SIZE: usize = 16;
pub const LAMPORT_NUMBER: u64 = 1000000000;

impl Processor {

    pub fn transfer_tokens<'a>(
      spl_token_account: &AccountInfo<'a>,
      source_account: &AccountInfo<'a>,
      destination_account: &AccountInfo<'a>,
      authority_account: &AccountInfo<'a>,
      tokens_to_transfer: u64,
      cpi_option: Option<[u8; 32]>,
    ) -> ProgramResult {

      //create instruction
      let transfer_token_instruction = transfer(
        spl_token_account.key,
        source_account.key,
        destination_account.key,
        authority_account.key,
        &[],
        tokens_to_transfer,
      )?;

      //transfer the tokens
      //if the cpi_option Option is of the Some variant, then we need a CPI via invoke_signed. 
      //Otherwise, a normal transaction is fine
      if let Some(pda_seed) = cpi_option {
        //PDA case - transfer tokens from vesting account to user
        invoke_signed(
          &transfer_token_instruction,
          &[
              spl_token_account.clone(),
              source_account.clone(),
              destination_account.clone(),
              authority_account.clone(),
          ],
          //this needs to be the seed of the authority signing the transaction.
          //When we're unlocking tokens, its the seed of the vesting account
          &[&[&pda_seed]],
        )?;
      } else {
        //normal case for token transfer with a user as the authority
        invoke(
          &transfer_token_instruction,
          &[
            spl_token_account.clone(),
            source_account.clone(),
            destination_account.clone(),
            authority_account.clone(),
          ],
        )?;
      }
      Ok(())
    }

    pub fn create_new_account<'a>(
      fee_payer: &AccountInfo<'a>,
      account_to_create: &AccountInfo<'a>,
      account_to_create_seed: [u8; 32],
      rent_lamports: u64,
      size: u64,
      vesting_program: &Pubkey,
      system_program: &AccountInfo<'a>,
    ) -> ProgramResult {

      //create instructions
      let create_account_instructions = create_account(
        &fee_payer.key,
        &account_to_create.key,
        rent_lamports,
        size,
        &vesting_program
      );

      //create account
      invoke_signed(
        &create_account_instructions,
        &[
          system_program.clone(),
          fee_payer.clone(),
          account_to_create.clone(),
        ],
        &[&[&account_to_create_seed]]
      )?;
      Ok(())
    }

    pub fn validate_account(
      account: &AccountInfo,
      account_seed: [u8; 32],
      vesting_program: &Pubkey,
      error_message: &str
    ) -> ProgramResult {
      // Find the non reversible public key for the vesting account via the seed
      let derived_account_key = Pubkey::create_program_address(&[&account_seed], vesting_program)?;
      
      //verify the derived account key matches what we sent to the program
      if derived_account_key != *account.key {
        msg!("{}", error_message);
        return Err(ProgramError::InvalidArgument)
      }
      Ok(())
    }

    pub fn pack_schedule_vector(
      schedules: Vec<VestingSchedule>,
      mut account_data: RefMut<&mut [u8]>
    ) -> ProgramResult {
      let mut offset = DataHeader::LEN;
      for s in schedules.iter() {
        /*
          let state_schedule = VestingSchedule {
              release_time: s.release_time,
              amount: s.amount,
              creation_epoch: s.creation_epoch,
          };
          state_schedule.pack_into_slice(&mut account_data[offset..]);
          */
          s.pack_into_slice(&mut account_data[offset..]);
          offset += VestingSchedule::LEN;
      }
      Ok(())
    }

    pub fn get_and_validate_tokens_in_schedule(
      schedules: &Vec<VestingSchedule>
    ) -> Result<u64, ProgramError> {
      let mut total: u64 = 0;
      for s in schedules.iter() {
        let delta = total.checked_add(s.amount);
        match delta {
          Some(n) => total = n,
          None => return Err(ProgramError::InvalidInstructionData),
        }
      }
      Ok(total)
    }

    pub fn get_user_voting_power(
      schedules: Vec<VestingSchedule>,
      clock_sysvar_account: &AccountInfo
    ) -> Result<u64, ProgramError> {
      //setup what we need
      let num_of_schedules = schedules.len() as i32;
      let mut voting_power_vec = Vec::new();
      let clock = Clock::from_account_info(&clock_sysvar_account)?;
      let current_time = clock.unix_timestamp as u64;
      let current_epoch = current_time / SECONDS_IN_WEEK;
      let current_epoch_ts = current_epoch * SECONDS_IN_WEEK;

      //iterate through schedules 
      for s in schedules.iter() {
        let mut amount = s.amount;
        let release_time_ts = s.release_time;
        let creation_epoch = s.creation_epoch as u64;
        let creation_ts = creation_epoch * SECONDS_IN_WEEK;
        let slope = amount / MAX_LOCK_TIME;
        let bias = slope * (release_time_ts - creation_ts);

        //calculate voting power for this schedule
        let mut voting_power = bias - (slope * (current_epoch_ts - creation_ts));

        //need this in case tokens in a schedule are claimable. In that situation,
        //current_time > release_time_seconds, so voting power is a negative number. 
        //Claimable tokens shouldn't contribute to voting power, but they shouldn't count 
        //against the user either. just ignore them
        if voting_power < 0 {
          voting_power = 0;
        }
        voting_power_vec.push(voting_power);
      }

      //sum the voting powers
      let mut sum = 0;
      for one_voting_power in voting_power_vec.iter() {
        sum += one_voting_power;
      }

      //return the average voting power. divide by lamport number to make it more readable.
      return Ok(sum / LAMPORT_NUMBER)
    }

    pub fn get_epoch(
      ts: u64
    ) -> u16 {
      return (ts / SECONDS_IN_WEEK) as u16
    }

    pub fn get_current_epoch(
      clock_sysvar_account: &AccountInfo
    ) -> Result<u16, ProgramError> {
      let clock = Clock::from_account_info(&clock_sysvar_account)?;
      let current_timestamp = clock.unix_timestamp as u64; //i64
      let current_epoch = Self::get_epoch(current_timestamp);
      Ok(current_epoch)
    }

    pub fn get_empty_schedule() -> Result<VestingSchedule, ProgramError> {
      let empty_schedule = VestingSchedule{
        release_time: 0,
        amount: 0,
        creation_epoch: 0,
      };
      return Ok(empty_schedule)
    }

    pub fn get_first_epoch_in_era(
      pointer_account: &AccountInfo
    ) -> Result<u16, ProgramError> {
      let pointer_data = pointer_account.data.borrow();
      let first_epoch = u16::from_le_bytes(pointer_data[0..2].try_into().unwrap());
      Ok(first_epoch)
    }

    pub fn get_last_epoch_in_era(
      pointer_account: &AccountInfo
    ) -> Result<u16, ProgramError> {
      let first_epoch_in_era = Self::get_first_epoch_in_era(pointer_account)?;
      Ok(first_epoch_in_era + EPOCHS_IN_ERA - 1)
    }

    pub fn get_dslope_index_from_epoch(
      epoch: u16,
      first_epoch_in_era: u16
    ) -> Result<usize, ProgramError> {
      Ok((epoch - first_epoch_in_era) as usize)
    }

    //given a timestamp, returns the first epoch in that timestamp's era.
    pub fn get_first_epoch_in_new_era(
      current_ts: u64
    ) -> Result<u16, ProgramError> {
      let zero_epoch_ts = ZERO_EPOCH as u64 * SECONDS_IN_WEEK;
      let seconds_in_era = SECONDS_IN_WEEK * EPOCHS_IN_ERA as u64;
      let mut left_ts = zero_epoch_ts;
      let mut right_ts = zero_epoch_ts + seconds_in_era;
      let mut check = true;
      while check {
        if left_ts <= current_ts && current_ts < right_ts {
          check = false;
          break
        } else {
          left_ts += seconds_in_era;
          right_ts += seconds_in_era;
        }
      }
      let first_epoch = left_ts / SECONDS_IN_WEEK;
      Ok(first_epoch as u16)
    }


    pub fn get_last_filed_point(
      cal_account: &AccountInfo,
      pointer_account: &AccountInfo,
    ) -> Result<Point, ProgramError> {
      //get the last filed epoch for the window start from the first 4 bytes of calendar data. 
      let last_filed_epoch = Self::get_last_filed_epoch(cal_account)?;

      //get the first epoch in the era
      let first_epoch_in_era = Self::get_first_epoch_in_era(pointer_account)?;

      //find out where the point object we're looking for lives
      let diff = (last_filed_epoch - first_epoch_in_era) as usize;
      let offset = (CalendarAccountHeader::LEN);
      let first_byte_index = offset + (diff * Point::LEN );
      let second_byte_index = offset + ((diff + 1) * Point::LEN);
      let cal_data = cal_account.data.borrow();
      let point = Point::unpack(&cal_data[first_byte_index..second_byte_index])?;
      //TODO - make sure the epoch filed in the point object matches the one we're looking for.

      Ok(point)
    }

    
    pub fn get_last_filed_epoch(
      cal_account: &AccountInfo,
    ) -> Result<u16, ProgramError> {
      let cal_data = cal_account.data.borrow();
      let cal_header = CalendarAccountHeader::unpack(&cal_data[0..CalendarAccountHeader::LEN])?;
      let last_filed_epoch = cal_header.last_filed_epoch;
      Ok(last_filed_epoch)
    }

    pub fn get_dslope(
      pointer_account: &AccountInfo,
      dslope_account: &AccountInfo,
      schedule: VestingSchedule,
    ) -> Result<i128, ProgramError> {
      //TODO => make sure the dslope account is found within the pointer account. 
      
      //schedule release time will be zero when we pass in an empty schedule while getting
      //the old dslope value. dslope should be zero in that case: we won't have any previous
      //changes we'd need to revise for that user's dslope. We'd only need to touch the new
      //unlock dslope account.
      let mut dslope: i128 = 0;
      if schedule.release_time != 0 {
        let era_starting_epoch = Self::get_first_epoch_in_era(pointer_account)?;
        let unlock_epoch = Self::get_epoch(schedule.release_time);
        let dslope_index = Self::get_dslope_index_from_epoch(unlock_epoch, era_starting_epoch)?;
        let first_byte_index = (dslope_index * I128_SIZE) as usize;
        let second_byte_index = ((1 + dslope_index) * I128_SIZE) as usize;
        let dslope_data = dslope_account.data.borrow();
        let dslope = i128::
        from_le_bytes(dslope_data[first_byte_index..second_byte_index].try_into().unwrap());
      }
      Ok(dslope)
    }

    pub fn save_dslope(
      pointer_account: &AccountInfo,
      dslope_account: &AccountInfo,
      dslope_value: i128,
      schedule: VestingSchedule,
    ) -> ProgramResult {
      //TODO => make sure the dslope account is found within the pointer account. 
      let era_starting_epoch = Self::get_first_epoch_in_era(pointer_account)?;
      let unlock_epoch = Self::get_epoch(schedule.release_time);
      let mut dslope_data = dslope_account.data.borrow_mut();
      let dslope_index = Self::get_dslope_index_from_epoch(unlock_epoch, era_starting_epoch)?;
      let first_byte_index = (dslope_index * I128_SIZE) as usize;
      let dslope_bytes = dslope_value.to_le_bytes();
      for i in 0..I128_SIZE {
        dslope_data[i + first_byte_index] = dslope_bytes[i];
      }
      Ok(())
    }

    pub fn process_create_vesting_account(
        vesting_program: &Pubkey,
        accounts: &[AccountInfo],
        vesting_account_seed: [u8; 32],
        data_account_seed: [u8; 32],
        num_of_schedules: u32
    ) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let system_program = next_account_info(accounts_iter)?;
        let rent_sysvar_account = next_account_info(accounts_iter)?;
        let owner_account = next_account_info(accounts_iter)?;
        let vesting_account = next_account_info(accounts_iter)?;
        let data_account = next_account_info(accounts_iter)?;

        let rent = Rent::from_account_info(rent_sysvar_account)?;

        //validate vesting account
        Self::validate_account(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;

        //validate data account
        Self::validate_account(data_account, data_account_seed, vesting_program, "Provided data account is invalid")?;

        //get required sizes for the vesting account and data account
        let state_size = VestingScheduleHeader::LEN;
        let data_state_size = DataHeader::LEN + (num_of_schedules as usize) * VestingSchedule::LEN;

        //create the vesting account
        Self::create_new_account(
          owner_account,
          vesting_account,
          vesting_account_seed,
          rent.minimum_balance(state_size),
          state_size as u64,
          vesting_program,
          system_program,
        )?;

        //create the data account
        Self::create_new_account(
          owner_account,
          data_account,
          data_account_seed,
          rent.minimum_balance(data_state_size),
          data_state_size as u64,
          vesting_program,
          system_program,
        )?;
        Ok(())
    }

    pub fn process_populate_vesting_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      vesting_account_seed: [u8; 32],
      data_account_seed: [u8; 32],
      owner_token_address: &Pubkey,
      years_to_lock: f32,
      schedule: Vec<VestingSchedule>,
  ) -> ProgramResult {
      
      //may God have mercy on my soul for all these accounts
      let accounts_iter = &mut accounts.iter();
      let spl_token_account = next_account_info(accounts_iter)?;
      let vesting_account = next_account_info(accounts_iter)?;
      let vesting_token_account = next_account_info(accounts_iter)?;
      let owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
      let owner_token_account = next_account_info(accounts_iter)?; //owner's token account pubkey
      let data_account = next_account_info(accounts_iter)?;
      let mint_account = next_account_info(accounts_iter)?;
      let window_start_pointer = next_account_info(accounts_iter)?;
      let window_start_cal = next_account_info(accounts_iter)?;
      let window_start_dslope = next_account_info(accounts_iter)?;
      let window_end_pointer = next_account_info(accounts_iter)?;
      let window_end_cal = next_account_info(accounts_iter)?;
      let window_end_dslope = next_account_info(accounts_iter)?;
      let new_unlock_pointer = next_account_info(accounts_iter)?;
      let new_unlock_dlsope = next_account_info(accounts_iter)?;
      let old_unlock_pointer = next_account_info(accounts_iter)?;
      let old_unlock_dslope = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      msg!("populating a net new vesting account!");
      msg!("years to lock is {}", years_to_lock);

      if !owner_account.is_signer {
          msg!("Owner of token account should be a signer.");
          return Err(ProgramError::InvalidArgument);
      }

      if *vesting_account.owner != *vesting_program {
          msg!("Program should own vesting account");
          return Err(ProgramError::InvalidArgument);
      }

      // Verifying that no SVC was already created with this seed
      let is_initialized =
          vesting_account.try_borrow_data()?[VestingScheduleHeader::LEN - 1] == 1;

      if is_initialized {
          msg!("Cannot overwrite an existing vesting contract.");
          return Err(ProgramError::InvalidArgument);
      }
      
      //validate the vesting token account
      let vesting_token_account_data = Account::unpack(&vesting_token_account.data.borrow())?;
      if vesting_token_account_data.owner != *vesting_account.key {
          msg!("The vesting token account should be owned by the vesting account.");
          return Err(ProgramError::InvalidArgument);
      }
      if vesting_token_account_data.delegate.is_some() {
          msg!("The vesting token account should not have a delegate authority");
          return Err(ProgramError::InvalidAccountData);
      }
      if vesting_token_account_data.close_authority.is_some() {
          msg!("The vesting token account should not have a close authority");
          return Err(ProgramError::InvalidAccountData);
      }
      let mut vesting_account_data = vesting_account.data.borrow_mut();
      if vesting_account_data.len() != VestingScheduleHeader::LEN  {
          msg!("invalid vesting account size");
          return Err(ProgramError::InvalidAccountData)
      }
      
      //create the state header to be saved in the vesting account
      let state_header = VestingScheduleHeader {
          destination_address: *owner_token_address,
          destination_address_owner: *owner_account.key,
          data_account: *data_account.key,
          mint_address: *mint_account.key,
          is_initialized: true,
      };
      
      //pack the vesting account data
      state_header.pack_into_slice(&mut vesting_account_data);

      //validate the size of the data account. wrap this part in a block to end the 
      //borrow of the data account's data: we'll be borrowing it again in the deposit fn. 
      {
        let data_account_data = data_account.data.borrow();
        if data_account_data.len() != DataHeader::LEN + (schedule.len() * VestingSchedule::LEN) {
            msg!("invalid data account size");
            return Err(ProgramError::InvalidAccountData)
        }
      }
      
      //get nuts and bolts we'll need for the deposit
      let amount_to_transfer = Self::get_and_validate_tokens_in_schedule(&schedule)?;
      let updated_schedule = schedule[0].clone();
      let empty_schedule = Self::get_empty_schedule()?;
      
      Self::deposit(
        vesting_program,
        vesting_account,
        vesting_account_seed,
        data_account,
        data_account_seed,
        vesting_token_account,
        owner_account,
        owner_token_account,
        spl_token_account,
        amount_to_transfer,
        schedule,
        empty_schedule,
        updated_schedule,
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
        new_unlock_pointer,
        new_unlock_dlsope,
        old_unlock_pointer,
        old_unlock_dslope,
        clock_sysvar_account,
      )?;
      
      Ok(())
  }

    pub fn process_unlock(
        vesting_program: &Pubkey,
        _accounts: &[AccountInfo],
        vesting_account_seed: [u8; 32],
    ) -> ProgramResult {
        let accounts_iter = &mut _accounts.iter();

        let spl_token_account = next_account_info(accounts_iter)?;
        let clock_sysvar_account = next_account_info(accounts_iter)?;
        let vesting_account = next_account_info(accounts_iter)?;
        let vesting_token_account = next_account_info(accounts_iter)?;
        let owner_token_account = next_account_info(accounts_iter)?;
        let data_account = next_account_info(accounts_iter)?;

        //validate vesting account
        Self::validate_account(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;

        if spl_token_account.key != &spl_token::id() {
            msg!("The provided spl token program account is invalid");
            return Err(ProgramError::InvalidArgument)
        }

        let packed_state = &vesting_account.data;
        let header_state =
            VestingScheduleHeader::unpack(&packed_state.borrow()[..VestingScheduleHeader::LEN])?;

        if header_state.destination_address != *owner_token_account.key {
            msg!("Account to receive tokens saved in the vesting account does not matched the provided token account");
            return Err(ProgramError::InvalidArgument);
        }

        let owner_token_account_data = Account::unpack(&owner_token_account.data.borrow())?;
        if header_state.destination_address_owner != owner_token_account_data.owner {
          msg!("The token account provided does not have the same owner as the vesting account!");
          return Err(ProgramError::InvalidArgument);
        }

        if header_state.data_account != *data_account.key {
          msg!("data account passed in does not match data account stored in vesting account");
          return Err(ProgramError::InvalidArgument);
        }

        let vesting_token_account_data = Account::unpack(&vesting_token_account.data.borrow())?;
        if vesting_token_account_data.owner != *vesting_account.key {
            msg!("The vesting token account should be owned by the vesting account.");
            return Err(ProgramError::InvalidArgument);
        }

        //Validate that the pubkey stored in the DataHeader is the user's vesting account
        let data_header = DataHeader::unpack(
          &data_account.data.borrow()[..DataHeader::LEN],
        )?;
        if data_header.vesting_account != *vesting_account.key {
          msg!("the vesting account stored on the data account does not match the vesting account passed in");
          return Err(ProgramError::InvalidArgument);
        }

        //get the schedules from the data account
        let data_account_packed_data = &data_account.data;
        let mut schedules = unpack_schedules(
          &data_account_packed_data.borrow()[DataHeader::LEN..]
        )?;

        // Unlock the schedules that have reached maturity
        let clock = Clock::from_account_info(&clock_sysvar_account)?;
        let mut total_amount_to_transfer = 0;
        for s in schedules.iter_mut() {
            if clock.unix_timestamp as u64 >= s.release_time {
                total_amount_to_transfer += s.amount;
                s.amount = 0;
            }
        }
        if total_amount_to_transfer == 0 {
            msg!("Vesting contract has not yet reached release time");
            return Err(ProgramError::InvalidArgument);
        }
        msg!("total amount to transfer {}", total_amount_to_transfer);

        //CPI transfer - the vesting account is the authority, so we need a CPI here.
        Self::transfer_tokens(
          spl_token_account,
          vesting_token_account,
          owner_token_account,
          vesting_account,
          total_amount_to_transfer,
          Some(vesting_account_seed),
        )?;
        
        //Reset released amounts to 0 in the schedules. This makes the simple unlock safe with 
        //complex scheduling contracts
        pack_schedules_into_slice(
            schedules,
            &mut data_account_packed_data.borrow_mut()[DataHeader::LEN..],
        );
        
        Ok(())
    }

    pub fn process_create_data_account(
        vesting_program: &Pubkey,
        accounts: &[AccountInfo],
        vesting_account_seed: [u8; 32],
        new_data_account_seed: [u8; 32],
        new_schedules: Vec<VestingSchedule>,
    ) -> ProgramResult {
      msg!("we are in the init data account function!");

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let vesting_account = next_account_info(accounts_iter)?;
      let owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;
      let old_data_account = next_account_info(accounts_iter)?;
      let new_data_account = next_account_info(accounts_iter)?;

      //validate the vesting account and the new data account
      Self::validate_account(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;
      Self::validate_account(new_data_account, new_data_account_seed, vesting_program, "Provided key for new data account is invalid")?;

      //Obtain and validate the public key of the old data account that's saved in the 
      //vesting account's data
      let vesting_account_packed_state = &vesting_account.data;
      let vesting_account_header =
          VestingScheduleHeader::unpack(&vesting_account_packed_state.borrow()[..VestingScheduleHeader::LEN])?;
      let old_data_account_key = vesting_account_header.data_account;
      if old_data_account_key != *old_data_account.key {
        msg!("invalid key for old data account");
        return Err(ProgramError::InvalidArgument);
      };

      //Obtain the old schedules from the old data account. 
      let old_data_packed_state = &old_data_account.data;
      let old_schedules = unpack_schedules(
        &old_data_packed_state.borrow()[DataHeader::LEN..]
      )?;

      //get the numbers of new schedules and the number of old schedules saved
      let num_of_schedules_to_add = new_schedules.len();
      let num_of_old_schedules = old_schedules.len();
      let new_num_of_schedules = num_of_schedules_to_add + num_of_old_schedules;

      //calculate the rent that will be needed for the new data account.
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      let new_data_state_size = (new_num_of_schedules as usize) * VestingSchedule::LEN + DataHeader::LEN;

      //create the new data account
      Self::create_new_account(
        owner_account,
        new_data_account,
        new_data_account_seed,
        rent.minimum_balance(new_data_state_size),
        new_data_state_size as u64,
        vesting_program,
        system_program,
      )?;

      //It looks like we can't create an account and update its data within one instruction, 
      //so we'll need to create a new set of instructions + processing function to do that :(

      Ok(())
    }

 
    pub fn process_populate_data_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      vesting_account_seed: [u8; 32],
      new_data_account_seed: [u8; 32],
      tokens_to_add: u64,
      mut new_schedules: Vec<VestingSchedule>,
    ) -> ProgramResult {

      //may God have mercy on my soul for all these accounts. 
      let accounts_iter = &mut accounts.iter();
      let vesting_account = next_account_info(accounts_iter)?;
      let vesting_token_account = next_account_info(accounts_iter)?;
      let owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
      let owner_token_account = next_account_info(accounts_iter)?;
      let old_data_account = next_account_info(accounts_iter)?;
      let new_data_account = next_account_info(accounts_iter)?;
      let spl_token_account = next_account_info(accounts_iter)?;
      let window_start_pointer = next_account_info(accounts_iter)?;
      let window_start_cal = next_account_info(accounts_iter)?;
      let window_start_dslope = next_account_info(accounts_iter)?;
      let window_end_pointer = next_account_info(accounts_iter)?;
      let window_end_cal = next_account_info(accounts_iter)?;
      let window_end_dslope = next_account_info(accounts_iter)?;
      let new_unlock_pointer = next_account_info(accounts_iter)?;
      let new_unlock_dlsope = next_account_info(accounts_iter)?;
      let old_unlock_pointer = next_account_info(accounts_iter)?;
      let old_unlock_dslope = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      //Obtain and validate the public key of the old data account that's saved in the 
      //vesting account's data
      let vesting_account_packed_state = &vesting_account.data;
      let vesting_account_header =
          VestingScheduleHeader::unpack(&vesting_account_packed_state.borrow()[..VestingScheduleHeader::LEN])?;
      let old_data_account_key = vesting_account_header.data_account;
      if old_data_account_key != *old_data_account.key {
        msg!("invalid key for old data account");
        return Err(ProgramError::InvalidArgument);
      };

      //Obtain the old schedules from the old data account. 
      let old_data_packed_state = &old_data_account.data;
      let old_schedules = unpack_schedules(
        &old_data_packed_state.borrow()[DataHeader::LEN..]
      )?;

      //get the numbers of new schedules and the number of old schedules saved
      let num_of_schedules_to_add = new_schedules.len();
      let num_of_old_schedules = old_schedules.len();
      let new_num_of_schedules = num_of_schedules_to_add + num_of_old_schedules;

      //validate the new data account's size. wrap it in a block so we end the 
      //borrow here: we'll be mutably borrowing the data in the deposit fn.
      {
        let new_data_account_data = new_data_account.data.borrow_mut();
        if new_data_account_data.len() != (new_num_of_schedules as usize) * VestingSchedule::LEN + DataHeader::LEN {
            msg!("invalid account size for the new data account");
            return Err(ProgramError::InvalidAccountData)
        }
      }


      //validate the token amount in the new schedule we passed in.
      let tokens_in_new_schedule = Self::get_and_validate_tokens_in_schedule(&new_schedules)?;
      if tokens_in_new_schedule != tokens_to_add {
        msg!("tokens in the schedule does not match the tokens to transfer that we passed in");
        return Err(ProgramError::InvalidArgument)
      }

      //get some misc things we'll need for the protocol update part of the token transfer
      //we'll probably run into some troubles with the clone portion of this: we need a 
      //dupliacte of schedules[0] to go in new_schedule b/c new_schedules is cleared later.
      let new_schedule = new_schedules[0].clone();
      msg!("new schedule release time {}", new_schedule.release_time);
      msg!("new schedule tokens {}", new_schedule.amount);
      let empty_schedule = Self::get_empty_schedule()?;

      //create an all schedules vector that contains all of our schedules.
      //Note this operation mutates new_schedules and leaves it empty.
      let mut all_schedules = old_schedules;
      all_schedules.append(&mut new_schedules);

      //make sure the new total amount of tokens in the token account doesn't result in an
      //overflow. We don't actually need the new_total_tokens var for anything here
      let _new_total_tokens = Self::get_and_validate_tokens_in_schedule(&all_schedules)?;

      //validate the size of the vesting account
      let mut vesting_account_data = vesting_account.data.borrow_mut();
      if vesting_account_data.len() != VestingScheduleHeader::LEN  {
        msg!("invalid vesting account size");
        return Err(ProgramError::InvalidAccountData)
      }

      //change the data in the vesting account so it points to the new data account
      let destination_address = vesting_account_header.destination_address;
      let destination_address_owner = vesting_account_header.destination_address_owner;
      let mint_address = vesting_account_header.mint_address;
      let new_vesting_account_header = VestingScheduleHeader {
        destination_address: destination_address,
        destination_address_owner: destination_address_owner,
        data_account: *new_data_account.key,
        mint_address: mint_address,
        is_initialized: true
      };
      new_vesting_account_header.pack_into_slice(&mut vesting_account_data);

      //actually deposit the tokens
      Self::deposit(
        vesting_program,
        vesting_account,
        vesting_account_seed,
        new_data_account,
        new_data_account_seed,
        vesting_token_account,
        owner_account,
        owner_token_account,
        spl_token_account,
        tokens_in_new_schedule,
        all_schedules,
        empty_schedule,
        new_schedule,
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
        new_unlock_pointer,
        new_unlock_dlsope,
        old_unlock_pointer,
        old_unlock_dslope,
        clock_sysvar_account
      )?;

      //transfer the rent lamports from the old data account back to the vesting account owner.
      //this will effectively close the old data account. 
      msg!("closing the old data account");
      **owner_account.lamports.borrow_mut() = owner_account.lamports()
        .checked_add(old_data_account.lamports())
        .ok_or(VestingError::AmountOverflow)?;
      **old_data_account.lamports.borrow_mut() = 0;

      //also wipe the data from this account, since we don't need it anymore. 
      //good practice according to paulx
      *old_data_account.data.borrow_mut() = &mut [];
          
      Ok(())
    }

    pub fn deposit<'a>(
      vesting_program: &Pubkey,
      vesting_account: &AccountInfo<'a>,
      vesting_account_seed: [u8; 32],
      data_account: &AccountInfo<'a>,
      data_account_seed: [u8; 32],
      vesting_token_account: &AccountInfo<'a>,
      owner_account: &AccountInfo<'a>,
      owner_token_account: &AccountInfo<'a>,
      spl_token_account: &AccountInfo<'a>,
      amount_to_transfer: u64,
      all_schedules: Vec<VestingSchedule>,
      old_schedule: VestingSchedule,
      new_schedule: VestingSchedule,
      window_start_pointer: &AccountInfo<'a>,
      window_start_cal: &AccountInfo<'a>,
      window_start_dslope: &AccountInfo<'a>,
      window_end_pointer: &AccountInfo<'a>,
      window_end_cal: &AccountInfo<'a>,
      window_end_dslope: &AccountInfo<'a>,
      new_unlock_pointer: &AccountInfo<'a>,
      new_unlock_dlsope: &AccountInfo<'a>,
      old_unlock_pointer: &AccountInfo<'a>,
      old_unlock_dslope: &AccountInfo<'a>,
      clock_sysvar_account: &AccountInfo<'a>,
    ) -> ProgramResult {

      //update the protocol's voting power before we change the user's info.
      msg!("updating protocol curve");
      Self::update_protocol_curve(
        old_schedule, 
        new_schedule, 
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
        new_unlock_pointer,
        new_unlock_dlsope,
        old_unlock_pointer,
        old_unlock_dslope,
        clock_sysvar_account
      )?;

      msg!("protocol update successful! Depositing tokens");
      //validate the vesting account and the new data account
      Self::validate_account(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;
      Self::validate_account(data_account, data_account_seed, vesting_program, "Provided key for new data account is invalid")?;

      //pack the vesting account key into the data account's data.
      let mut data_account_data = data_account.data.borrow_mut();
      let data_header = DataHeader {
        vesting_account: *vesting_account.key,
        is_initialized: true,
      };
      data_header.pack_into_slice(&mut data_account_data);

      //pack the schedules into the data account
      msg!("all schedules {:?}", all_schedules);
      Self::pack_schedule_vector(all_schedules.to_vec(), data_account_data)?;

      //validate there are enough tokens in the owner's account
      msg!("amount to lock {}", amount_to_transfer);
      if Account::unpack(&owner_token_account.data.borrow())?.amount < amount_to_transfer {
          msg!("The source token account has insufficient funds.");
          return Err(ProgramError::InsufficientFunds)
      };

      //transfer tokens - user's connected wallet is the authority
      Self::transfer_tokens(
        spl_token_account,
        owner_token_account,
        vesting_token_account,
        owner_account,
        amount_to_transfer,
        None
      )?;

      Ok(())
    }

    pub fn update_protocol_curve(
      old_schedule: VestingSchedule,
      new_schedule: VestingSchedule,
      window_start_pointer: &AccountInfo,
      window_start_cal: &AccountInfo,
      window_start_dslope: &AccountInfo,
      window_end_pointer: &AccountInfo,
      window_end_cal: &AccountInfo,
      window_end_dslope: &AccountInfo,
      new_unlock_pointer: &AccountInfo,
      new_unlock_dslope: &AccountInfo,
      old_unlock_pointer: &AccountInfo,
      old_unlock_dslope: &AccountInfo,
      clock_sysvar_account: &AccountInfo,
    ) -> ProgramResult {

      //bring the protocol curve up to date (if needed)
      //first, get the current epoch
      let current_epoch = Self::get_current_epoch(clock_sysvar_account)?;
      
      //get the last filed point from the calendar account
      //TODO - make sure the epoch filed in the point object matches the one we're looking for.
      let last_filed_point = Self::get_last_filed_point( 
        window_start_cal,
        window_start_pointer,
      )?;

      let last_filed_epoch = Self::get_last_filed_epoch(
        window_start_cal
      )?;


      //then, get the final epoch in the for the starting era
      let final_epoch_in_window_start = Self::get_last_epoch_in_era(window_start_pointer)?;
      //if the last filed epoch is NOT the current epoch, launch into the loops
      //start at the point object after the last filed one. Create a net new point object with the appropriate slope (and dslope changes). 
        //A helper function to get dslope index from era + epoch would be nice here
      //increment the last filed epoch for the account we pass in
      //file the new point object to the calendar. check to see if the last point object we filed was for the current epoch OR if we filed the last point for this era. 
        //if it was, quit out of this loop.
        //if it wasn't, do it all again.
      //serialize the last filed epoch for the account.
      //quit with the last point object that we touched. 

      //clone or borrow most of the inputs since we'll need them later.
      msg!("iterating over window start"); 
      let mut last_point = Self::fill_in_window(
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
        &new_unlock_pointer,
        &new_unlock_dslope,
        &old_unlock_pointer,
        &old_unlock_dslope,
        current_epoch.clone(),
        last_filed_point.clone(),
        last_filed_epoch, // TODO => check to see if this is what curve does
        final_epoch_in_window_start,
        old_schedule.clone(),
        new_schedule.clone(),
      )?;

      //if the last piece of the window start that we touched wasn't the current date, iterate through the window end until we hit the current date. Same process as before.
      //start at the newest point object
      msg!("iterating over window end");
      if current_epoch != last_point.epoch {
        let first_epoch_in_window_end = Self::get_first_epoch_in_era(window_end_cal)?;
        last_point = Self::fill_in_window(
          window_end_pointer,
          window_end_cal,
          window_end_dslope,
          new_unlock_pointer,
          new_unlock_dslope,
          old_unlock_pointer,
          old_unlock_dslope,
          current_epoch,
          last_point.clone(),
          first_epoch_in_window_end,
          current_epoch,
          old_schedule,
          new_schedule,
        )?;
      }



      

      //sounds like we could have a loop for the filling in that gets called twice: once on the window start and once on the window end. What would it need passed in?
        //calendar account
        //dslope account
        //current epoch
        //start point of the loop (the epoch we begin at. This will be the last filed epoch + 1 (?) for the window start, and the first epoch in the window end. )
        //endpoint of the loop (the epoch of the last point when we call this on window start, and the current epoch for when we call this on window end. 
        //return the last point object that we operated on.)
      //some helper methods that would be a boon here:
          //get the dslope index from the first epoch in era and the current epoch. => done
          //get the first epoch in an era by looking at the first point in the calendar account. => done
          //get the last point of an era by looking at the first point in the calendar account. => done
          //getting the current epoch => done


      //update the data for the current point oject in the window end
      //also update the dslope situation for the unlock pointer. 
      Ok(())
    }


    //if the last filed epoch is NOT the current epoch, launch into the loops
    //start at the point object after the last filed one. Create a net new point object with the appropriate slope (and dslope changes). 
      //A helper function to get dslope index from era + epoch would be nice here
    //increment the last filed epoch for the account we pass in
    //file the new point object to the calendar. check to see if the last point object we filed was for the current epoch OR if we filed the last point for this era. 
      //if it was, quit out of this loop.
      //if it wasn't, do it all again.
    //serialize the last filed epoch for the account.
    //quit with the last point object that we touched. 
    pub fn fill_in_window(
      window_pointer: &AccountInfo,
      window_cal: &AccountInfo,
      window_dslope: &AccountInfo,
      new_unlock_pointer: &AccountInfo,
      new_unlock_dslope: &AccountInfo,
      old_unlock_pointer: &AccountInfo,
      old_unlock_dslope: &AccountInfo,
      current_epoch: u16,
      mut last_filed_point: Point,
      starting_epoch: u16,
      ending_epoch: u16,
      old_schedule: VestingSchedule, 
      new_schedule: VestingSchedule,
    ) -> Result<Point, ProgramError> {
      //init the last point outside the loop so we have access to it outside the loop
      let first_epoch = Self::get_first_epoch_in_era(window_pointer)?;
      let diff = starting_epoch - first_epoch;
      let offset = (CalendarAccountHeader::LEN as u16);
      let mut first_byte_index_cal = (offset + (diff * Point::LEN as u16)) as usize;
      let mut second_byte_index_cal = (offset + ((diff + 1) * Point::LEN as u16)) as usize;
      let mut cal_data = window_cal.data.borrow_mut();
      let mut dslope: i128 = 0;
      let dslope_data = window_dslope.data.borrow();
      let dslope_index = Self::get_dslope_index_from_epoch(starting_epoch, first_epoch)?;

      //dslopes are stored as i128s. an i128 is 16 bytes long. 
      let mut first_byte_index_dslope = (dslope_index * I128_SIZE) as usize;
      let mut second_byte_index_dslope = ((1 + dslope_index) * I128_SIZE) as usize;

      //init the new_point object here so that we can use it later
      let mut new_point = Point{
        slope: 0,
        bias: 0,
        epoch: 0,
      };

      //do we need to have the equal to sign here? 
      //TODO => save the last filed epoch to the cal account here. 
      let mut epoch_counter = starting_epoch;

      //if the last filed point is the current epoch's point, then all we need to do is update
      //that point with the user information. 
      while epoch_counter <= ending_epoch {
        new_point = Point::unpack(&cal_data[first_byte_index_cal..second_byte_index_cal])?;
        if epoch_counter == current_epoch {
          //we don't need to catch the current epoch's point up: all we need to do are apply
          //the user's changes, which we'll do below. 
          break
        } else {
          dslope = i128::from_le_bytes(
            dslope_data[first_byte_index_dslope..second_byte_index_dslope]
            .try_into()
            .unwrap()
          );
          //new bias is the last point's bias - the last points slope * the time since the last point
          let mut new_point_bias = last_filed_point.bias - (last_filed_point.slope * SECONDS_IN_WEEK as i128);
          let mut new_point_slope = last_filed_point.slope - dslope; 
          if new_point_bias < 0 {
            new_point_bias = 0;
          }
          if new_point_slope < 0 {
            new_point_slope = 0;
          }
          new_point.slope = new_point_slope;
          new_point.bias = new_point_bias;
          new_point.epoch = epoch_counter;
          new_point.pack_into_slice(&mut cal_data[first_byte_index_cal..second_byte_index_cal]);
          //need this clone here for the compiler's happiness. May be unessecary with a loop
          //refactor if we need to optimize.
          last_filed_point = new_point.clone();
          epoch_counter += 1;
          first_byte_index_cal += Point::LEN;
          second_byte_index_cal += Point::LEN;
          first_byte_index_dslope += I128_SIZE;
          second_byte_index_dslope += I128_SIZE;
        }
      }
      
      

      //if we've quit out at the current epoch, save the user information in the new point
      if epoch_counter == current_epoch {
        //schedule the dslope changes here... TODO => we need the unlock period dslope account
        //for both the new unlock period and the old unlock period...

        //get user info we'll need for dslope calculations
        let u_old_slope = old_schedule.amount / MAX_LOCK_TIME;
        let u_old_bias = u_old_slope * (old_schedule.release_time - (SECONDS_IN_WEEK * current_epoch as u64));
        let u_new_slope = new_schedule.amount / MAX_LOCK_TIME;
        let u_new_bias = u_new_slope * (new_schedule.release_time - (SECONDS_IN_WEEK * current_epoch as u64));

        
        msg!("user slope {}", u_new_slope);
        msg!("user bias! {}", u_new_bias);
        msg!("old user slope {}", u_old_slope);
        msg!("old user bias! {}", u_old_bias);
        
        //get the dslope for the old unlock time.
        let mut old_unlock_dslope_value = Self::get_dslope(
          old_unlock_pointer,
          old_unlock_dslope,
          old_schedule.clone()
        )?;

        //figure out what new_unlock_dslope should be
        //init the new_unlock_dslope so we can access it outside the loop
        let mut new_unlock_dslope_value: i128 = 0;
        if new_schedule.release_time != 0 {
          if new_schedule.release_time == old_schedule.release_time {
            new_unlock_dslope_value = old_unlock_dslope_value;
          } else {
            new_unlock_dslope_value = Self::get_dslope(
              new_unlock_pointer,
              new_unlock_dslope,
              new_schedule.clone()
            )?;
          }
        }

        //save the dslope information to the appropriate accounts. 
        if old_schedule.release_time > (current_epoch as u64 * SECONDS_IN_WEEK) {
          old_unlock_dslope_value += u_old_slope as i128;
          // in this case, u_new_slope = u_old_slope, so there's no change to the old_unlock_slope:
          //we're not changing the time that the tokens in this schedule unlock
          if new_schedule.release_time == old_schedule.release_time {
            old_unlock_dslope_value -= u_new_slope as i128;
          }
          Self::save_dslope(
            old_unlock_pointer, 
            old_unlock_dslope, 
            old_unlock_dslope_value,
            old_schedule.clone(),
          )?;
        }

        if new_schedule.release_time > (current_epoch as u64 * SECONDS_IN_WEEK) {
          if new_schedule.release_time > old_schedule.release_time {
            new_unlock_dslope_value -= u_new_slope as i128;
            Self::save_dslope(
              new_unlock_pointer, 
              new_unlock_dslope, 
              new_unlock_dslope_value,
              new_schedule,
            )?;
          }
        }


        //save user information here. 
        new_point.slope += (u_new_slope - u_old_slope) as i128;
        new_point.bias += (u_new_bias - u_old_bias) as i128;
        new_point.epoch = current_epoch;
        if new_point.slope < 0 {
          new_point.slope = 0;
        }
        if new_point.bias < 0 {
          new_point.bias = 0;
        }
        msg!("new point we're saving {:?}", new_point);
        new_point.pack_into_slice(&mut cal_data[first_byte_index_cal..second_byte_index_cal]);
        let test_point = Point::unpack(&cal_data[first_byte_index_cal..second_byte_index_cal])?;
        msg!("test unpacking the point {:?}", test_point);
      }

      //save the last filed epoch to the calendar account we're working with. 
      let new_cal_header = CalendarAccountHeader{
        last_filed_epoch: epoch_counter,
        is_initialized: true
      };
      new_cal_header.pack_into_slice(&mut cal_data[0..CalendarAccountHeader::LEN]);
  
      Ok(new_point)
    }

    pub fn process_voting_power_test(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      vesting_account_seed: [u8; 32],
      client_voting_power: u64,
    ) -> ProgramResult {
      //get accounts
      let accounts_iter = &mut accounts.iter();
      let _owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
      let vesting_account = next_account_info(accounts_iter)?;
      let data_account = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      //validate the vesting account
      Self::validate_account(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;

      //get the data account pubKey
      let packed_state = &vesting_account.data;
      let header_state =
          VestingScheduleHeader::unpack(&packed_state.borrow()[..VestingScheduleHeader::LEN])?;

      if header_state.data_account != *data_account.key {
        msg!("data account passed in does not match data account stored in vesting account");
        return Err(ProgramError::InvalidArgument);
      }

      let data_account_data = &data_account.data;
      let schedules = unpack_schedules(
        &data_account_data.borrow()[DataHeader::LEN..]
      )?;
      let voting_power = Self::get_user_voting_power(schedules, clock_sysvar_account)?;

      //casting as a u64 will take the integer value of the voting power and ignore the decimals
      msg!("voting power from client is {}", client_voting_power);
      msg!("voting power from on chain function is {}", voting_power);

      Ok(())
    }

    pub fn process_create_calendar_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      calendar_seed: [u8; 32],
      account_size: u64
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;

      //calculate rent
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      let rent_to_pay = rent.minimum_balance(account_size as usize);
      msg!("the new calendar account will cost {} lamports to initialize", rent_to_pay);

      //create the new account
      Self::create_new_account(
        fee_payer_account,
        calendar_account,
        calendar_seed,
        rent_to_pay,
        account_size as u64,
        vesting_program,
        system_program
      )?;

      Ok(())
    }

    pub fn process_populate_new_calendar_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      mut first_epoch_in_era: u16
    ) -> ProgramResult {
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let clock_account = next_account_info(accounts_iter)?;
      //TODO => validate the first_epoch_in_era passed in by obtaining the first epoch
      //in the current timestamp's era.
      
      let mut cal_data = calendar_account.data.borrow_mut();
      let header = CalendarAccountHeader{
        last_filed_epoch: first_epoch_in_era,
        is_initialized: true
      };
      header.pack_into_slice(&mut cal_data[0..CalendarAccountHeader::LEN]);

      Ok(())
    }

    pub fn process_create_dslope_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      dslope_seed: [u8; 32],
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let dslope_account = next_account_info(accounts_iter)?;
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;

      //calculate rent
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      //needs to store an array of i128s: one for each week in the epoch
      //maybe that would get expensive? how much to store 832 bytes?
      let account_size = (16 * EPOCHS_IN_ERA) as usize;
      let rent_to_pay = rent.minimum_balance(account_size as usize);
      msg!("the dlsope account will cost {} lamports to initialize", rent_to_pay);

      //create the new account
      Self::create_new_account(
        fee_payer_account,
        dslope_account,
        dslope_seed,
        rent_to_pay,
        account_size as u64,
        vesting_program,
        system_program
      )?;

      Ok(())
    }
    

    pub fn process_create_pointer_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      pointer_seed: [u8; 32],
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;

      //calculate rent
      let account_size = PointerAccountHeader::LEN;
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      let rent_to_pay = rent.minimum_balance(account_size);
      msg!("the pointer account will cost {} lamports to initialize", rent_to_pay);

      //create the new account
      Self::create_new_account(
        fee_payer_account,
        pointer_account,
        pointer_seed,
        rent_to_pay,
        account_size as u64,
        vesting_program,
        system_program
      )?;

      Ok(())
    }

    pub fn process_populate_pointer_account(
      accounts: &[AccountInfo],
      first_epoch_in_era: u16,
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let _fee_payer_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let dslope_account = next_account_info(accounts_iter)?;

      let pointer_header = PointerAccountHeader{
        first_epoch: first_epoch_in_era,
        calendar_account: *calendar_account.key,
        dslope_account: *dslope_account.key,
        is_initialized: true,
      };
      let mut pointer_data = pointer_account.data.borrow_mut();

      //don't need a slice since this is all the data that will be in the 
      //pointer account
      pointer_header.pack_into_slice(&mut pointer_data);

      Ok(())
    }

    
    pub fn process_transfer_calendar_data(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      new_calendar_account_seed: [u8; 32],
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let owner_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let new_cal_account = next_account_info(accounts_iter)?;
      //don't use this now, but may for validation later
      let old_cal_account = next_account_info(accounts_iter)?;

      //get some info from the old header
      let mut pointer_data = pointer_account.data.borrow_mut();
      let old_header = PointerAccountHeader::unpack(&pointer_data)?;

      //create a new pointer account header with the new cal account. 
      let new_header = PointerAccountHeader{
        first_epoch: old_header.first_epoch,
        calendar_account: *new_cal_account.key,
        dslope_account: old_header.dslope_account,
        is_initialized: old_header.is_initialized
      };

      //save the new header to the pointer account.
      new_header.pack_into_slice(&mut pointer_data);

      //transfer data from the old account to the new one.
      let old_cal_data = old_cal_account.data.borrow();
      let old_data_len = old_cal_account.data_len();
      let mut new_cal_data = new_cal_account.data.borrow_mut();

      for i in 0..old_data_len {
        new_cal_data[i] = old_cal_data[i]
      }

      //transfer the rent lamports from the old data account back to the vesting account owner.
      //this will effectively close the old data account. 
      msg!("closing the old calendar account");
      **owner_account.lamports.borrow_mut() = owner_account.lamports()
        .checked_add(old_cal_account.lamports())
        .ok_or(VestingError::AmountOverflow)?;
      **old_cal_account.lamports.borrow_mut() = 0;

      //also wipe the data from this account, since we don't need it anymore. 
      //good practice according to paulx
      *old_cal_account.data.borrow_mut() = &mut [];

      //erase the data from the old data account. 

      Ok(())
    }

    pub fn process_instruction(
        vesting_program: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        msg!("Beginning processing");
        let instruction = VestingInstruction::unpack(instruction_data)?;
        msg!("Instruction unpacked");
        match instruction {
            VestingInstruction::CreateVestingAccount {
                vesting_account_seed,
                data_account_seed,
                number_of_schedules,
            } => {
                msg!("Instruction: create a vesting account");
                Self::process_create_vesting_account(
                  vesting_program, 
                  accounts, 
                  vesting_account_seed, 
                  data_account_seed, 
                  number_of_schedules,
                )
            }
            VestingInstruction::Unlock { vesting_account_seed } => {
                msg!("Instruction: Unlock tokens");
                Self::process_unlock(vesting_program, accounts, vesting_account_seed)
            }
            VestingInstruction::PopulateVestingAccount {
                vesting_account_seed,
                data_account_seed,
                destination_token_address,
                years_to_lock,
                schedules,
            } => {
                msg!("Instruction: populate a vesting account");
                Self::process_populate_vesting_account(
                    vesting_program,
                    accounts,
                    vesting_account_seed,
                    data_account_seed,
                    &destination_token_address,
                    years_to_lock,
                    schedules,
                )
            }
            VestingInstruction::CreateNewDataAccount {
              vesting_account_seed,
              new_data_account_seed,
              schedules,
            } => {
              msg!("Instruction: create a new data account");
              Self::process_create_data_account(
                vesting_program,
                accounts,
                vesting_account_seed,
                new_data_account_seed,
                schedules,
              )
            }
            VestingInstruction::PopulateNewDataAccount {
              vesting_account_seed,
              new_data_account_seed,
              tokens_to_add,
              schedules,
            } => {
              msg!("Instruction: Populate new data account");
              Self::process_populate_data_account(
                vesting_program,
                accounts,
                vesting_account_seed,
                new_data_account_seed,
                tokens_to_add,
                schedules,
              )
            }
            VestingInstruction::CreateCalendarAccount {
              calendar_account_seed,
              account_size,
            } => {
              msg!("creating a new calendar account");
              Self::process_create_calendar_account(
                vesting_program,
                accounts,
                calendar_account_seed,
                account_size
              )
            }
            VestingInstruction::PopulateCalendarAccount {
              first_epoch_in_era
            } => {
              msg!("populating the new calendar account");
              Self::process_populate_new_calendar_account(
                vesting_program,
                accounts,
                first_epoch_in_era
              )
            }
            VestingInstruction::CreateDslopeAccount{
              dslope_account_seed
            } => {
              msg!("creating a new dslope account");
              Self::process_create_dslope_account(
                vesting_program,
                accounts,
                dslope_account_seed
              )
            }
            VestingInstruction::CreatePointerAccount{
              pointer_account_seed
            } => {
              msg!("creating a new pointer account");
              Self::process_create_pointer_account(
                vesting_program,
                accounts,
                pointer_account_seed
              )
            }
            VestingInstruction::PopulatePointerAccount{
              first_epoch_in_era
            } =>{
              msg!("populating a pointer account");
              Self::process_populate_pointer_account(
                accounts,
                first_epoch_in_era
              )
            }
            VestingInstruction::TransferCalendarData{
              new_calendar_account_seed,
            } => {
              msg!("populating a new calendar account");
              Self::process_transfer_calendar_data(
                vesting_program,
                accounts,
                new_calendar_account_seed,
              )
            }
            VestingInstruction::TestOnChainVotingPower {
              vesting_account_seed,
              client_voting_power
            } => {
              msg!("testing on chain voting power function!");
              Self::process_voting_power_test(
                vesting_program,
                accounts,
                vesting_account_seed,
                client_voting_power,
              )
            }
        }
    }
  }
impl PrintProgramError for VestingError {
    fn print<E>(&self)
    where
        E: 'static + std::error::Error + DecodeError<E> + PrintProgramError + FromPrimitive,
    {
        match self {
            VestingError::InvalidInstruction => msg!("Error: Invalid instruction!"),
            VestingError::AmountOverflow => msg!("Error: Amount Overflow!"),
        }
    }
}
