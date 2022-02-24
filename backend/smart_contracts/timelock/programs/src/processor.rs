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
    error::{VestingError},
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

pub const SECONDS_IN_EPOCH: u64 = 604800; //seconds in an epoch
//pub const SECONDS_IN_EPOCH: u64 = 300; //5 mins. for testing purposes
pub const EPOCHS_IN_ERA: u16 = 26; //6 months
//epochs is number of weeks since our protocol's zero time. Not Solana epochs
pub const ZERO_EPOCH_TS: u64 = 1_641_427_200; //# of seconds since the unix zero time and our protocol's zero time (1/6/22 0000 GMT). 
//pub const ZERO_EPOCH_TS: u64 = 	1645572300; 
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
        &vesting_program,
      );

      //create account
      invoke_signed(
        &create_account_instructions,
        &[
          //system_program.clone(),
          fee_payer.clone(),
          account_to_create.clone(),
          //vesting_program.clone(), Does this need to be here?
        ],
        &[&[&account_to_create_seed]]
      )?;
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
      schedules: &Vec<VestingSchedule>,
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

    pub fn get_ts_from_epoch(
      epoch: u16,
    ) -> Result<u64, ProgramError> {
      return Ok((epoch as u64 * SECONDS_IN_EPOCH) + ZERO_EPOCH_TS)
    }

    pub fn get_user_voting_power(
      schedules: Vec<VestingSchedule>,
      clock_sysvar_account: &AccountInfo
    ) -> Result<i128, ProgramError> {
      //setup what we need
      let mut voting_power_vec = Vec::new();
      let current_epoch = Self::get_current_epoch(clock_sysvar_account)?;
      let current_epoch_ts = Self::get_ts_from_epoch(current_epoch)? as i128;

      //iterate through schedules 
      for s in schedules.iter() {
        let amount = s.amount;
        let release_time_ts = s.release_time as i128;
        let creation_epoch = s.creation_epoch;
        let creation_ts = Self::get_ts_from_epoch(creation_epoch)? as i128;
        let slope = (amount / MAX_LOCK_TIME) as i128;
        let bias = slope * (release_time_ts - creation_ts); //i128

        //calculate voting power for this schedule
        let mut voting_power = bias - (slope * (current_epoch_ts - creation_ts));

        //need this in case tokens in a schedule are claimable. In that situation,
        //current_time > release_time_seconds, so voting power is a negative number. 
        //Claimable tokens shouldn't contribute to voting power, but they shouldn't count 
        //against the user either. just ignore them
        if voting_power < 0 {
          voting_power = 0;
        }
        msg!("one voting power is {}", voting_power);
        voting_power_vec.push(voting_power);
      }

      msg!("voting power vector {:?}", voting_power_vec);
      //sum the voting powers
      let mut sum = 0;
      for one_voting_power in voting_power_vec {
        sum += one_voting_power;
      }

      //return the average voting power. divide by lamport number to make it more readable.
      return Ok(sum)
    }

    pub fn get_current_protocol_voting_power(
      pointer_account: &AccountInfo,
      cal_account: &AccountInfo,
      clock_sysvar_account: &AccountInfo,
    ) -> Result<i128, ProgramError> {
      let last_filed_point = Self::get_last_filed_point(
        pointer_account,
        cal_account,
      )?;
      
      let current_epoch = Self::get_current_epoch(clock_sysvar_account)?;
      let current_epoch_ts = Self::get_ts_from_epoch(current_epoch)? as i128;
      let point_ts = Self::get_ts_from_epoch(last_filed_point.epoch)? as i128;

      msg!("last filed point {:?}", last_filed_point);
      msg!("last current epoch ts {}", current_epoch_ts);
      msg!("point ts {}", point_ts);

      let mut voting_power = last_filed_point.bias - last_filed_point.slope * (current_epoch_ts - point_ts);
      //voting_power = voting_power / LAMPORT_NUMBER as i128;
      if voting_power < 0 {
        voting_power = 0;
      }

      Ok(voting_power)
    }

    //the zero epoch will have an epoch of 0. the next epoch will have an 
    //epoch of 1. and so on. 
    pub fn get_epoch(
      ts: u64
    ) -> u16 {
      return ((ts - ZERO_EPOCH_TS) / SECONDS_IN_EPOCH) as u16
    }

    pub fn get_current_epoch(
      clock_sysvar_account: &AccountInfo
    ) -> Result<u16, ProgramError> {
      let clock = Clock::from_account_info(&clock_sysvar_account)?;
      let current_timestamp = clock.unix_timestamp as u64; // clock.unix_timestamp is an i64
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
      clock_sysvar_account: &AccountInfo
    ) -> Result<u16, ProgramError> {

      let clock = Clock::from_account_info(&clock_sysvar_account)?;
      let current_ts = clock.unix_timestamp as u64; // clock.unix_timestamp is an i64

      //prevent an infinite loop
      if current_ts < ZERO_EPOCH_TS {
        return Err(VestingError::NegativeTime.into())
      }
      let seconds_in_era = SECONDS_IN_EPOCH * EPOCHS_IN_ERA as u64;
      let mut left_ts = ZERO_EPOCH_TS;
      let mut right_ts = ZERO_EPOCH_TS + seconds_in_era;
      let mut check = true;
      while check {
        if left_ts <= current_ts && current_ts < right_ts {
          break
        } else {
          left_ts += seconds_in_era;
          right_ts += seconds_in_era;
        }
      }
      let first_epoch = Self::get_epoch(left_ts);
      Ok(first_epoch)
    }


    pub fn get_last_filed_point(
      pointer_account: &AccountInfo,
      cal_account: &AccountInfo,
    ) -> Result<Point, ProgramError> {
      let first_byte_index = Self::get_last_filed_point_index(
        pointer_account,
        cal_account,
      )?;
      let second_byte_index = first_byte_index + Point::LEN;
      let cal_data = cal_account.data.borrow();
      let point = Point::unpack(&cal_data[first_byte_index..second_byte_index])?;
      
      //make sure the epoch filed in the point object matches the last epoch filed to the calendar
      let point_last_filed_epoch = point.epoch;
      let calendar_header = CalendarAccountHeader::unpack(&cal_data[0..CalendarAccountHeader::LEN])?;
      if point_last_filed_epoch != calendar_header.last_filed_epoch {
        return Err(VestingError::PointCalendarDesyncronization.into())
      }

      Ok(point)
    }

    pub fn get_last_filed_point_index(
      pointer_account: &AccountInfo,
      cal_account: &AccountInfo,
    ) -> Result<usize, ProgramError> {
      //get the last filed epoch for the window start from the first 4 bytes of calendar data. 
      let last_filed_epoch = Self::get_last_filed_epoch(cal_account)?;

      //get the first epoch in the era
      let first_epoch_in_era = Self::get_first_epoch_in_era(pointer_account)?;

      //find out where the point object we're looking for lives
      let diff = (last_filed_epoch - first_epoch_in_era) as usize;
      let offset = CalendarAccountHeader::LEN;
      let first_index = offset + (diff * Point::LEN );
      Ok(first_index)
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
      ts: u64,
    ) -> Result<i128, ProgramError> {
      
      //ts will be zero when we're creating a new schedule because we pass in an empty 
      //schedule as the old schedule.
      //dslope should be zero in that case: we won't have any previous scheduled dslope 
      //changes we need to revise for that user's previous position. We'd only need to touch
      //the new unlock dslope account.
      let mut dslope: i128 = 0;
      if ts != 0 {
        let era_starting_epoch = Self::get_first_epoch_in_era(pointer_account)?;
        let unlock_epoch = Self::get_epoch(ts);
        let dslope_index = Self::get_dslope_index_from_epoch(unlock_epoch, era_starting_epoch)?;
        let first_byte_index = (dslope_index * I128_SIZE) as usize;
        let second_byte_index = ((1 + dslope_index) * I128_SIZE) as usize;
        let dslope_data = dslope_account.data.borrow();
        dslope = i128::
        from_le_bytes(dslope_data[first_byte_index..second_byte_index].try_into().unwrap());
      }
      Ok(dslope)
    }

    pub fn save_dslope(
      pointer_account: &AccountInfo,
      dslope_account: &AccountInfo,
      mut new_dslope_value: i128,
      schedule: VestingSchedule,
    ) -> ProgramResult {
      //TODO => make sure the dslope account is found within the pointer account. 
      let era_starting_epoch = Self::get_first_epoch_in_era(pointer_account)?;
      let unlock_epoch = Self::get_epoch(schedule.release_time);
      let dslope_index = Self::get_dslope_index_from_epoch(unlock_epoch, era_starting_epoch)?;
      let existing_dslope_value = Self::get_dslope(
        pointer_account,
        dslope_account,
        schedule.release_time,
      )?;
      new_dslope_value += existing_dslope_value;
      msg!("pointer account we're saving to {}", pointer_account.key);
      msg!("dslope account we're saving to {}", dslope_account.key);
      msg!("dslope index we're saving to {}", dslope_index);
      msg!("existing dslope value! {}", existing_dslope_value);
      msg!("new dslope value! {}", new_dslope_value);
      let first_byte_index = (dslope_index * I128_SIZE) as usize;
      let dslope_bytes = new_dslope_value.to_le_bytes();
      let mut dslope_data = dslope_account.data.borrow_mut();
      for i in 0..I128_SIZE {
        dslope_data[i + first_byte_index] = dslope_bytes[i];
      }
      msg!("dslope bytes {:?}", dslope_bytes);
      msg!("dslope data post-save {:?}", dslope_data);
      Ok(())
    }

    
    pub fn validate_account_seeds(
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

    //validate that the calendar account and dslope account are found within the given pointer
    //account. Also make sure that all accounts are pdas owned by the vesting program
    pub fn validate_infrastructure_accounts(
      vesting_program: &Pubkey,
      pointer_account: &AccountInfo,
      calendar_account: &AccountInfo,
      dslope_account: &AccountInfo,
    ) -> ProgramResult {
      Self::validate_dslope_account(vesting_program, pointer_account, dslope_account)?;
      Self::validate_calendar_account(vesting_program, pointer_account, calendar_account)?;
      Ok(())
    }

    pub fn validate_dslope_account(
      vesting_program: &Pubkey,
      pointer_account: &AccountInfo,
      dslope_account: &AccountInfo,
    ) -> ProgramResult {
      let pointer_data = pointer_account.data.borrow();
      let pointer_header = PointerAccountHeader::unpack(&pointer_data[0..PointerAccountHeader::LEN])?;
      if pointer_header.dslope_account != *dslope_account.key {
        return Err(VestingError::PointerDslopeMismatch.into())
      }
      if dslope_account.owner != vesting_program {
        msg!("dslope account {:?} is not owned by the vesting program", dslope_account.key);
        return Err(ProgramError::InvalidArgument);
      }
      if pointer_account.owner != vesting_program {
        msg!("pointer account {:?} is not owned by the vesting program", pointer_account.key);
        return Err(ProgramError::InvalidArgument);
      }
      Ok(())
    }

    //make sure the calendar account is in the pointer account, and that the calendar
    //and pointer accounts are owned by the vesting program
    pub fn validate_calendar_account(
      vesting_program:& Pubkey,
      pointer_account: &AccountInfo,
      calendar_account: &AccountInfo,
    ) -> ProgramResult {
      let pointer_data = pointer_account.data.borrow();
      let pointer_header = PointerAccountHeader::unpack(&pointer_data[0..PointerAccountHeader::LEN])?;
      if pointer_header.calendar_account != *calendar_account.key {
        return Err(VestingError::PointerCalendarMismatch.into())
      }
      if calendar_account.owner != vesting_program {
        msg!("calendar account {:?} is not owned by the vesting program", calendar_account.key);
        return Err(ProgramError::InvalidArgument);
      }
      if pointer_account.owner != vesting_program {
        msg!("pointer account {:?} is not owned by the vesting program", pointer_account.key);
        return Err(ProgramError::InvalidArgument);
      }
      Ok(())
    }

    pub fn validate_creation_programs(
      system_program: &AccountInfo,
      rent_sysvar_account: &AccountInfo,
    ) -> ProgramResult {
      if solana_program::system_program::id() != *system_program.key {
        msg!("the provided system program is invalid");
        return Err(ProgramError::InvalidArgument)
      }
      if solana_program::sysvar::rent::id() != *rent_sysvar_account.key {
        msg!("the provided rent sysvar program is invalid");
        return Err(ProgramError::InvalidArgument)
      }
      Ok(())
    }

    pub fn validate_token_account(
      spl_token_account: &AccountInfo,
    ) -> ProgramResult {
      if spl_token_account.key != &spl_token::id() {
        msg!("The provided spl token program account is invalid");
        return Err(ProgramError::InvalidArgument)
      }
      Ok(())
    }

    pub fn validate_clock_account(
      clock_sysvar_account: &AccountInfo,
    ) -> ProgramResult {
      if *clock_sysvar_account.key != solana_program::sysvar::clock::id() {
        msg!("The provided clock sysvar account is invalid");
        return Err(ProgramError::InvalidArgument)
      }
      Ok(())
    }

    pub fn validate_vesting_token_accounts(
      owner_account: &AccountInfo,
      vesting_account: &AccountInfo,
      vesting_account_header: &VestingScheduleHeader,
      owner_token_account: &AccountInfo,
      vesting_token_account: &AccountInfo,
    ) -> ProgramResult {
      
      if vesting_account_header.destination_address != *owner_token_account.key {
        msg!("Account to receive tokens saved in the vesting account does not matched the provided token account");
        return Err(ProgramError::InvalidArgument);
      }

      let owner_token_account_data = Account::unpack(&owner_token_account.data.borrow())?;
      if vesting_account_header.destination_address_owner != owner_token_account_data.owner {
        msg!("The token account provided does not have the same owner as the vesting account!");
        return Err(ProgramError::InvalidArgument);
      }

      if owner_token_account_data.owner != *owner_account.key {
        msg!("the owner account provided does not own the token account provided");
        return Err(ProgramError::InvalidArgument);
      }

      let vesting_token_account_data = Account::unpack(&vesting_token_account.data.borrow())?;
      if vesting_token_account_data.owner != *vesting_account.key {
          msg!("The vesting token account should be owned by the vesting account.");
          return Err(ProgramError::InvalidArgument);
      }
      Ok(())
    }

    pub fn validate_signer(
      signer_account: &AccountInfo,
    ) -> ProgramResult {
      if !signer_account.is_signer {
        msg!("Invalid signer account.");
        return Err(ProgramError::InvalidArgument);
      }
      Ok(())
    }

    //make sure that the pdas we pass in are actually owned by the vesting program.
    pub fn validate_pda_ownership(
      vesting_program: &Pubkey,
      pda_vec: Vec<&AccountInfo>,
    ) -> ProgramResult {
      //msg!("{:?}", pda_vec);
      for pda in pda_vec.iter() {
        if pda.owner != vesting_program {
          msg!("pda {:?} is not owned by {:?}, not by the vesting program", pda.key, pda.owner);
          return Err(ProgramError::InvalidArgument);
        }
      }
      Ok(())
    }

    pub fn validate_new_calendar_account(
      vesting_program: &Pubkey,
      old_cal_account: &AccountInfo,
      new_cal_account: &AccountInfo,
    ) -> ProgramResult {
      let initial_seed_bytes = old_cal_account.key.to_bytes();
      let sliced_seed_bytes = &initial_seed_bytes[0..31];
      let (derived_account_key, bump) = Pubkey::find_program_address(
        &[&sliced_seed_bytes],
        vesting_program,
      );
      if derived_account_key != *new_cal_account.key {
        msg!("new calendar account is not valid");
        return Err(ProgramError::InvalidArgument);
      }

      Ok(())
    }

    pub fn derive_key(
      word_base: &str,
      pointer_bytes: &[u8],
      vesting_program: &Pubkey,
    ) -> Result<Pubkey, ProgramError> {
      let word_bytes = word_base.as_bytes(); // => &[u8]
      let mut initial_seed_bytes = [word_bytes, pointer_bytes].concat();
      let sliced_seed_bytes = &initial_seed_bytes[0..31];
      let (account_key, bump) = Pubkey::find_program_address(
        &[&sliced_seed_bytes],
        vesting_program,
      );
      Ok(account_key)
    }

    //make sure the calendar and dslope accounts fit for the pointer they're being saved to by
    //re-deriving their keys. 
    pub fn validate_pointer_fit(
      vesting_program: &Pubkey,
      pointer_account: &AccountInfo,
      cal_account: &AccountInfo,
      dslope_account: &AccountInfo,
    ) -> ProgramResult {
      let pointer_bytes = pointer_account.key.to_bytes(); //=> [u8; 32]
      let derived_cal_key = Self::derive_key("calendar", &pointer_bytes[0..], vesting_program)?;
      if *cal_account.key != derived_cal_key {
        msg!("calendar account does not match the pointer account");
        return Err(ProgramError::InvalidArgument)
      }
      
      let derived_dslope_key = Self::derive_key("dslope", &pointer_bytes[0..], vesting_program)?;
      if *dslope_account.key != derived_dslope_key {
        msg!("calendar account does not match the pointer account");
        return Err(ProgramError::InvalidArgument)
      }

      Ok(())
    }

    //make sure that the vesting account and data account are owned by the tx signer AND that
    //the data account provided lives in the vesting account provided
    pub fn validate_user_data_accounts(
      vesting_account: &AccountInfo,
      data_account: &AccountInfo,
      owner_account: &AccountInfo,
    ) -> ProgramResult {
      //get our headers
      let vesting_header = 
      VestingScheduleHeader::unpack(&vesting_account.data.borrow()[..VestingScheduleHeader::LEN])?;
      let data_header = 
      DataHeader::unpack(&data_account.data.borrow()[..DataHeader::LEN])?;

      //validate
      if vesting_header.destination_address_owner != *owner_account.key {
        msg!("tx signer does not own the provided vesting account");
        return Err(ProgramError::InvalidArgument)
      }
      if vesting_header.data_account != *data_account.key {
        msg!("vesting account's data account does not match the data account provided");
        return Err(ProgramError::InvalidArgument)
      }
      if data_header.vesting_account != *vesting_account.key {
        msg!("data accounts vesting account does not match the vesting account provided");
        return Err(ProgramError::InvalidArgument)
      }
      //make sure the owner is a signer (aka, that the owner is a real person)
      Self::validate_signer(owner_account)?;

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

        //validate vesting account
        Self::validate_account_seeds(vesting_account, vesting_account_seed, vesting_program, "Provided vesting account is invalid")?;

        //validate data account
        Self::validate_account_seeds(data_account, data_account_seed, vesting_program, "Provided data account is invalid")?;

        //validate solana programs
        Self::validate_creation_programs(system_program, rent_sysvar_account)?;

        //get required sizes for the vesting account and data account
        let state_size = VestingScheduleHeader::LEN;
        let data_state_size = DataHeader::LEN + (num_of_schedules as usize) * VestingSchedule::LEN;
        let rent = Rent::from_account_info(rent_sysvar_account)?;

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
      let new_unlock_dslope = next_account_info(accounts_iter)?;
      let old_unlock_pointer = next_account_info(accounts_iter)?;
      let old_unlock_dslope = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      msg!("populating a net new vesting account!");
      msg!("years to lock is {}", years_to_lock);

      //validate accounts
      Self::validate_infrastructure_accounts(
        vesting_program,
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
      )?;
      Self::validate_infrastructure_accounts(
        vesting_program,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
      )?;
      Self::validate_dslope_account(
        vesting_program,
        new_unlock_pointer,
        new_unlock_dslope
      )?;
      Self::validate_dslope_account(
        vesting_program,
        old_unlock_pointer,
        old_unlock_dslope
      )?;
      Self::validate_clock_account(clock_sysvar_account)?;
      Self::validate_token_account(spl_token_account)?;
      
      //validate that the program owns our pdas
      let mut pda_vec = Vec::new();
      pda_vec.push(vesting_account);
      pda_vec.push(data_account);
      Self::validate_pda_ownership(vesting_program, pda_vec)?;

      //validate the user's vesting and data accounts
      Self::validate_user_data_accounts(
        vesting_account,
        data_account,
        owner_account,
      )?;
      

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

      //for now, our "old schedule" will be an empty schedule. I handle this case in my code,
      //but we want the old schedule to be the user's previous position eventually.
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
        new_unlock_dslope,
        old_unlock_pointer,
        old_unlock_dslope,
        clock_sysvar_account,
      )?;
      
      Ok(())
  }

    pub fn process_unlock(
        vesting_program: &Pubkey,
        accounts: &[AccountInfo],
        vesting_account_seed: [u8; 32],
    ) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let owner_account = next_account_info(accounts_iter)?;
        let spl_token_account = next_account_info(accounts_iter)?;
        let clock_sysvar_account = next_account_info(accounts_iter)?;
        let vesting_account = next_account_info(accounts_iter)?;
        let vesting_token_account = next_account_info(accounts_iter)?;
        let owner_token_account = next_account_info(accounts_iter)?;
        let data_account = next_account_info(accounts_iter)?;

        //validate vesting account
        Self::validate_account_seeds(vesting_account, vesting_account_seed, vesting_program, "Provided vesting account is invalid")?;

        //validate token account and clock account
        Self::validate_token_account(spl_token_account)?;
        Self::validate_clock_account(clock_sysvar_account)?;

        
        //validate pda ownership
        let mut pda_vec = Vec::new();
        pda_vec.push(vesting_account);
        pda_vec.push(data_account);
        Self::validate_pda_ownership(vesting_program, pda_vec)?;

        //validate the user's vesting and data accounts
        Self::validate_user_data_accounts(
          vesting_account,
          data_account,
          owner_account,
        )?;

        //validate the token accounts involved in this tx.
        let packed_state = &vesting_account.data;
        let vesting_account_header =
            VestingScheduleHeader::unpack(&packed_state.borrow()[..VestingScheduleHeader::LEN])?;

        Self::validate_vesting_token_accounts(
          owner_account,
          vesting_account,
          &vesting_account_header,
          owner_token_account,
          vesting_token_account
        )?;

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
      Self::validate_account_seeds(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;
      Self::validate_account_seeds(new_data_account, new_data_account_seed, vesting_program, "Provided key for new data account is invalid")?;

      //validate solana programs
      Self::validate_creation_programs(system_program, rent_sysvar_account)?;

      //validate signer
      Self::validate_signer(owner_account)?;
      
      //validate pda ownership
      let mut pda_vec = Vec::new();
      pda_vec.push(vesting_account);
      pda_vec.push(old_data_account);
      Self::validate_pda_ownership(vesting_program, pda_vec)?;
      
      //validate the user's vesting and data accounts
      Self::validate_user_data_accounts(
        vesting_account,
        old_data_account,
        owner_account,
      )?;

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
      let new_unlock_dslope = next_account_info(accounts_iter)?;
      let old_unlock_pointer = next_account_info(accounts_iter)?;
      let old_unlock_dslope = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      //validate accounts
      Self::validate_infrastructure_accounts(
        vesting_program,
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
      )?;
      Self::validate_infrastructure_accounts(
        vesting_program,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
      )?;
      Self::validate_dslope_account(
        vesting_program,
        new_unlock_pointer,
        new_unlock_dslope
      )?;
      Self::validate_dslope_account(
        vesting_program,
        old_unlock_pointer,
        old_unlock_dslope
      )?;
      Self::validate_clock_account(
        clock_sysvar_account,
      )?;
      Self::validate_token_account(
        spl_token_account,
      )?;

      //validate pda ownership
      let mut pda_vec = Vec::new();
      pda_vec.push(vesting_account);
      pda_vec.push(old_data_account);
      pda_vec.push(new_data_account);
      Self::validate_pda_ownership(vesting_program, pda_vec)?;
      
      //validate the user's vesting and data accounts
      Self::validate_user_data_accounts(
        vesting_account,
        old_data_account,
        owner_account,
      )?;

      let vesting_account_header = 
        VestingScheduleHeader::unpack(&vesting_account.data.borrow()[..VestingScheduleHeader::LEN])?;
      //validate the token accounts used in this tx
      Self::validate_vesting_token_accounts(
        owner_account,
        vesting_account,
        &vesting_account_header,
        owner_token_account,
        vesting_token_account
      )?;

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
      //borrow here: we'll be mutably borrowing the data in the deposit fn and
      //we want this borrow out of scope for that.
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

      //for now, our "old schedule" will be an empty schedule. I handle this case in my code,
      //but we want the old schedule to be the user's previous position eventually.
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
        new_unlock_dslope,
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
      new_unlock_dslope: &AccountInfo<'a>,
      old_unlock_pointer: &AccountInfo<'a>,
      old_unlock_dslope: &AccountInfo<'a>,
      clock_sysvar_account: &AccountInfo<'a>,
    ) -> ProgramResult {

      //update the protocol's voting power before we change the user's info.
      //first, get the current epoch
      let current_epoch = Self::get_current_epoch(clock_sysvar_account)?;
      msg!("updating protocol curve");
      let finished_at_window_start = Self::update_protocol_curve(
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
        current_epoch,
      )?;

      msg!("saving user data to protocol curve");
      //now that the protocol is up to date, add the user's information to it.
      //find out which calendar account we'll be saving info to.
      let mut pointer_account_to_save_to = window_end_pointer;
      let mut cal_account_to_save_to = window_end_cal;
      if finished_at_window_start {
        pointer_account_to_save_to = window_start_pointer;
        cal_account_to_save_to = window_start_cal;
      }
      Self::save_user_info_to_protocol(
        pointer_account_to_save_to,
        cal_account_to_save_to,
        new_unlock_pointer,
        new_unlock_dslope,
        old_unlock_pointer,
        old_unlock_dslope,
        old_schedule,
        new_schedule,
        current_epoch,
      )?;

      msg!("protocol update successful! Depositing tokens");
      //validate the vesting account and the new data account
      Self::validate_account_seeds(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;
      Self::validate_account_seeds(data_account, data_account_seed, vesting_program, "Provided key for new data account is invalid")?;

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
      window_start_pointer: &AccountInfo,
      window_start_cal: &AccountInfo,
      window_start_dslope: &AccountInfo,
      window_end_pointer: &AccountInfo,
      window_end_cal: &AccountInfo,
      window_end_dslope: &AccountInfo,
      current_epoch: u16,
    ) -> Result<bool, ProgramError> {

      //bring the protocol curve up to date (if needed)
      
      //get the last filed point from the calendar account
      //TODO - make sure the epoch filed in the point object matches the one we're looking for.
      let last_filed_point = Self::get_last_filed_point( 
        window_start_pointer,
        window_start_cal,
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

      let mut finished_at_window_start = true; 
      if last_filed_point.epoch == current_epoch {
        msg!("protocol curve is up to date! No iteration needed");
      } else {
        //protocol is not up to date: we'll need to iterate beginning at the window start
        msg!("iterating over window start");
        let mut last_point = Self::fill_in_window(
          window_start_pointer,
          window_start_cal,
          window_start_dslope,
          current_epoch.clone(),
          last_filed_point.clone(),
          last_filed_epoch + 1, //epoch to start iteration => this is what curve does so we don't apply dslope and bias changes to the current point multiple times
          final_epoch_in_window_start, //epoch to end iteration
        )?;

        //if the last piece of the window start that we touched wasn't the current date, iterate through the window end until we hit the current date. Same process as before.
        //start at the newest point object
        msg!("last point {:?}", last_point);
        if current_epoch != last_point.epoch {
          finished_at_window_start = false;
          msg!("iterating over window end");
          let first_epoch_in_window_end = Self::get_first_epoch_in_era(window_end_cal)?;
          last_point = Self::fill_in_window(
            window_end_pointer,
            window_end_cal,
            window_end_dslope,
            current_epoch,
            last_point.clone(),
            first_epoch_in_window_end, //epoch to start iteration
            current_epoch,             //epoch toend iteration
          )?;
        }
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
      Ok(finished_at_window_start)
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

    //we only enter this when the last filed point is NOT the current point
    //starting epoch has already had a point filed. we use that point to derive the next one. 
    pub fn fill_in_window(
      window_pointer: &AccountInfo,
      window_cal: &AccountInfo,
      window_dslope: &AccountInfo,
      current_epoch: u16,
      mut last_filed_point: Point,
      starting_epoch: u16,
      ending_epoch: u16,
    ) -> Result<Point, ProgramError> {
      //init the last point outside the loop so we have access to it outside the loop
      let first_epoch = Self::get_first_epoch_in_era(window_pointer)?;
      let diff = starting_epoch - first_epoch;
      let offset = CalendarAccountHeader::LEN as u16;
      let mut first_byte_index_cal = (offset + (diff * Point::LEN as u16)) as usize;
      let mut second_byte_index_cal = (offset + ((diff + 1) * Point::LEN as u16)) as usize;
      let mut cal_data = window_cal.data.borrow_mut();

      //we add 1 to starting index because we want the dslope value to come from the epoch
      //we're filing to, not the epoch we're starting from
      msg!("starting epoch {}", starting_epoch); //17
      msg!("first epoch {}", first_epoch); //0

      //init the new_point object here so that we can use it later
      let mut new_point = Point{
        slope: 0,
        bias: 0,
        epoch: 0,
      };

      //msg!("starting epoch {}", starting_epoch);
      msg!("ending epoch {}", ending_epoch);
      msg!("current epoch {}", current_epoch);

      //TOOD: rename epoch counter. The name is horrible. Doesn't convey any intuition
      //about what its doing. 
      let mut epoch_counter = starting_epoch;
      while epoch_counter <= ending_epoch {
        new_point = Point::unpack(&cal_data[first_byte_index_cal..second_byte_index_cal])?;
        //msg!("old point we're starting from {:?}", last_filed_point);
        let epoch_counter_ts = Self::get_ts_from_epoch(epoch_counter)?; 
        let dslope = Self::get_dslope(
          window_pointer,
          window_dslope,
          epoch_counter_ts,
        )?;
        //new bias is the last point's bias - the last points slope * the time since the last point
        // It should be equal to SECONDS_IN_EPOCH always. 
        let last_filed_point_ts = Self::get_ts_from_epoch(last_filed_point.epoch)?; 
        let time_difference = epoch_counter_ts - last_filed_point_ts;
        let mut new_point_bias = last_filed_point.bias - (last_filed_point.slope * time_difference as i128);
        let mut new_point_slope = last_filed_point.slope + dslope; 
        if new_point_bias < 0 {
          new_point_bias = 0;
        }
        if new_point_slope < 0 {
          new_point_slope = 0;
        }

        //write new values to our point object then save it
        new_point.slope = new_point_slope;
        new_point.bias = new_point_bias;
        new_point.epoch = epoch_counter;
        //msg!("dslope applied here {}", dslope);
        //msg!("new point in loop {:?}", new_point);
        new_point.pack_into_slice(&mut cal_data[first_byte_index_cal..second_byte_index_cal]);

        //don't keep going if we just saved the point for the current epoch.
        if epoch_counter == current_epoch {
          break
        }
        //increment and keep it looping.
        //need this clone here for the compiler's happiness. May be unessecary with a loop
        //refactor if we need to optimize.
        last_filed_point = new_point.clone();
        epoch_counter += 1;
        first_byte_index_cal += Point::LEN;
        second_byte_index_cal += Point::LEN;
      }

      //save the last filed epoch to the calendar account we're working with. 
      let new_cal_header = CalendarAccountHeader{
        last_filed_epoch: epoch_counter,
        is_initialized: true
      };
      new_cal_header.pack_into_slice(&mut cal_data[0..CalendarAccountHeader::LEN]);
      msg!("new point out of loop {:?}", new_point);
      Ok(new_point)
    }

    pub fn save_user_info_to_protocol(
      pointer_account: &AccountInfo,
      cal_account: &AccountInfo,
      new_unlock_pointer: &AccountInfo,
      new_unlock_dslope: &AccountInfo,
      old_unlock_pointer: &AccountInfo,
      old_unlock_dslope: &AccountInfo,
      old_schedule: VestingSchedule,
      new_schedule: VestingSchedule,
      current_epoch: u16, 
    ) -> ProgramResult {
      //save the user information in the new point
      //schedule the dslope changes here... TODO => we need the unlock period dslope account
      //for both the new unlock period and the old unlock period...

      //get user info we'll need for dslope calculations
      let u_old_slope = old_schedule.amount / MAX_LOCK_TIME;
      let current_epoch_ts = Self::get_ts_from_epoch(current_epoch)?;
      let u_old_bias = u_old_slope * (old_schedule.release_time - current_epoch_ts);
      let u_new_slope = new_schedule.amount / MAX_LOCK_TIME;
      let u_new_bias = u_new_slope * (new_schedule.release_time - current_epoch_ts);

      /*
      msg!("user slope {}", u_new_slope);
      msg!("user bias! {}", u_new_bias);
      msg!("old user slope {}", u_old_slope);
      msg!("old user bias! {}", u_old_bias);
      */
      
      //get the dslope for the old unlock time.
      let mut old_unlock_dslope_value = Self::get_dslope(
        old_unlock_pointer,
        old_unlock_dslope,
        old_schedule.release_time,
      )?;

      msg!("old unlock dslope {}", old_unlock_dslope_value);

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
            new_schedule.release_time,
          )?;
        }
      }

      msg!("unlock dslope value for time {} is {}",new_schedule.release_time, new_unlock_dslope_value);
      msg!("dslope change applied is {}", u_new_slope);
      //save the dslope information to the appropriate accounts. 
      if old_schedule.release_time > current_epoch_ts {
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

      if new_schedule.release_time > current_epoch_ts {
        if new_schedule.release_time > old_schedule.release_time {
          new_unlock_dslope_value -= u_new_slope as i128;
          msg!("dslope after change is applied is {}", new_unlock_dslope_value);
          Self::save_dslope(
            new_unlock_pointer, 
            new_unlock_dslope, 
            new_unlock_dslope_value,
            new_schedule,
          )?;
        }
      }


      //actually save user information here. 
      let mut new_point = Self::get_last_filed_point(
        pointer_account,
        cal_account,
      )?;
      new_point.slope += (u_new_slope - u_old_slope) as i128;
      new_point.bias += (u_new_bias - u_old_bias) as i128;
      new_point.epoch = current_epoch;
      if new_point.slope < 0 {
        new_point.slope = 0;
      }
      if new_point.bias < 0 {
        new_point.bias = 0;
      }
      let first_byte_index = Self::get_last_filed_point_index(
        pointer_account,
        cal_account,
      )?;
      let second_byte_index = first_byte_index + Point::LEN;
      let mut cal_data = cal_account.data.borrow_mut();
      msg!("new point we're saving {:?}", new_point);
      new_point.pack_into_slice(&mut cal_data[first_byte_index..second_byte_index]);
      Ok(())
    }

    pub fn process_protocol_voting_power_test(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
    ) -> ProgramResult {

      let accounts_iter = &mut accounts.iter();
      let window_start_pointer = next_account_info(accounts_iter)?;
      let window_start_cal = next_account_info(accounts_iter)?;
      let window_start_dslope = next_account_info(accounts_iter)?;
      let window_end_pointer = next_account_info(accounts_iter)?;
      let window_end_cal = next_account_info(accounts_iter)?;
      let window_end_dslope = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      //validate accounts
      Self::validate_infrastructure_accounts(
        vesting_program,
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
      )?;
      Self::validate_infrastructure_accounts(
        vesting_program,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
      )?;

      //validate clock
      Self::validate_clock_account(clock_sysvar_account)?;

      //first, see if we need to bring the protocol up to date. the update protocol curve
      //function will do this if needed, or do nothing if the protocol is up to date. 
      let current_epoch = Self::get_current_epoch(clock_sysvar_account)?;
      msg!("updating protocol curve");
      let finished_at_window_start = Self::update_protocol_curve(
        window_start_pointer,
        window_start_cal,
        window_start_dslope,
        window_end_pointer,
        window_end_cal,
        window_end_dslope,
        current_epoch,
      )?;

      //find out which window account has the most recently filed point. 
      let mut pointer_with_last_filed_point = window_end_pointer;
      let mut cal_with_last_filed_point = window_end_cal;
      if finished_at_window_start {
        pointer_with_last_filed_point = window_start_pointer;
        cal_with_last_filed_point = window_start_cal;
      }

      let voting_power = Self::get_current_protocol_voting_power(
        pointer_with_last_filed_point,
        cal_with_last_filed_point,
        clock_sysvar_account,
      )?;

      msg!("the on chain protocol voting power is {}", voting_power);
      Ok(())
    }

    pub fn process_user_voting_power_test(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      vesting_account_seed: [u8; 32],
      client_voting_power: u64,
    ) -> ProgramResult {
      //get accounts
      let accounts_iter = &mut accounts.iter();
      let owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
      let vesting_account = next_account_info(accounts_iter)?;
      let data_account = next_account_info(accounts_iter)?;
      let clock_sysvar_account = next_account_info(accounts_iter)?;

      //validate the vesting account
      Self::validate_account_seeds(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;

      //validate the clock
      Self::validate_clock_account(clock_sysvar_account)?;

      //validate signer
      Self::validate_signer(owner_account)?;

      
      //validate pda ownership
      let mut pda_vec = Vec::new();
      pda_vec.push(vesting_account);
      pda_vec.push(data_account);
      Self::validate_pda_ownership(vesting_program, pda_vec)?;

      Self::validate_user_data_accounts(
        vesting_account,
        data_account,
        owner_account,
      )?;
      
      //get the data account pubKey
      let packed_state = &vesting_account.data;
      let vesting_account_header =
          VestingScheduleHeader::unpack(&packed_state.borrow()[..VestingScheduleHeader::LEN])?;

      if vesting_account_header.data_account != *data_account.key {
        msg!("data account passed in does not match data account stored in vesting account");
        return Err(ProgramError::InvalidArgument);
      }

      //make sure the owner account "owns" the vesting account
      if vesting_account_header.destination_address_owner != *owner_account.key {
        msg!("owner account does not own the provided vesting account");
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

      //validate account seeds
      Self::validate_account_seeds(calendar_account, calendar_seed, vesting_program, "Provided calendar account is invalid")?;

      //validate solana programs
      Self::validate_creation_programs(system_program, rent_sysvar_account)?;

      //validate signer
      Self::validate_signer(fee_payer_account)?;

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

    pub fn process_create_window_accounts(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      pointer_seed: [u8; 32],
      calendar_seed: [u8; 32],
      dslope_seed: [u8; 32],
      calendar_size: u64,
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let dslope_account = next_account_info(accounts_iter)?;
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;

      //validate seeds
      Self::validate_account_seeds(dslope_account, dslope_seed, vesting_program, "Provided dslope account is invalid")?;
      Self::validate_account_seeds(calendar_account, calendar_seed, vesting_program, "Provided calendar account is invalid")?;
      Self::validate_account_seeds(pointer_account, pointer_seed, vesting_program, "Provided pointer account is invalid")?;

      //validate solana programs
      Self::validate_creation_programs(system_program, rent_sysvar_account)?;

      //validate signer
      Self::validate_signer(fee_payer_account)?;

      //calculate pointer rent
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      let pointer_account_size = PointerAccountHeader::LEN;
      let pointer_rent_to_pay = rent.minimum_balance(pointer_account_size);
      msg!("the pointer account will cost {} lamports to initialize", pointer_rent_to_pay);

      //calculate calendar rent
      let cal_rent_to_pay = rent.minimum_balance(calendar_size as usize);
      msg!("the new calendar account will cost {} lamports to initialize", cal_rent_to_pay);

      //calculate dslope size
      let dslope_account_size = I128_SIZE * EPOCHS_IN_ERA as usize;
      let dslope_rent_to_pay = rent.minimum_balance(dslope_account_size as usize);
      msg!("the dlsope account will cost {} lamports to initialize", dslope_rent_to_pay);

      //create the new pointer account
      Self::create_new_account(
        fee_payer_account,
        pointer_account,
        pointer_seed,
        pointer_rent_to_pay,
        pointer_account_size as u64,
        vesting_program,
        system_program
      )?;

      //create the calendar account
      Self::create_new_account(
        fee_payer_account,
        calendar_account,
        calendar_seed,
        cal_rent_to_pay,
        calendar_size as u64,
        vesting_program,
        system_program
      )?;

      //create the new dslope account
      Self::create_new_account(
        fee_payer_account,
        dslope_account,
        dslope_seed,
        dslope_rent_to_pay,
        dslope_account_size as u64,
        vesting_program,
        system_program
      )?;

      Ok(())
    }

    pub fn process_populate_window_accounts(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      first_epoch_in_era: u16,
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let _fee_payer_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let dslope_account = next_account_info(accounts_iter)?;

      
      //validate pda ownership
      let mut pda_vec = Vec::new();
      pda_vec.push(pointer_account);
      pda_vec.push(calendar_account);
      pda_vec.push(dslope_account);
      Self::validate_pda_ownership(vesting_program, pda_vec)?;
      

      //validate that the dslope and calendar accounts fit with the pointer
      Self::validate_pointer_fit(
        vesting_program,
        pointer_account,
        calendar_account,
        dslope_account,
      )?;

      //create and save the pointer header
      let pointer_header = PointerAccountHeader{
        first_epoch: first_epoch_in_era,
        calendar_account: *calendar_account.key,
        dslope_account: *dslope_account.key,
        is_initialized: true,
      };
      let mut pointer_data = pointer_account.data.borrow_mut();
      pointer_header.pack_into_slice(&mut pointer_data);

      //create and save the calendar header
      let cal_header = CalendarAccountHeader{
        last_filed_epoch: first_epoch_in_era,
        is_initialized: true
      };
      let mut cal_data = calendar_account.data.borrow_mut();
      cal_header.pack_into_slice(&mut cal_data[0..CalendarAccountHeader::LEN]);

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
      let old_cal_account = next_account_info(accounts_iter)?;

      //validate seed
      Self::validate_account_seeds(new_cal_account, new_calendar_account_seed, vesting_program, "Provided calendar account is invalid")?;

      //validate old calendar account
      Self::validate_calendar_account(vesting_program, pointer_account, old_cal_account)?;

      //validate the new calendar account
      Self::validate_new_calendar_account(vesting_program, old_cal_account, new_cal_account)?;

      
      //validate pda ownership
      let mut pda_vec = Vec::new();
      pda_vec.push(pointer_account);
      pda_vec.push(new_cal_account);
      pda_vec.push(old_cal_account);
      Self::validate_pda_ownership(vesting_program, pda_vec)?;
      

      //validate signer
      Self::validate_signer(owner_account)?;

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
      let old_data_len = old_cal_account.data_len();
      let mut old_cal_data = old_cal_account.data.borrow_mut();
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
      *old_cal_data = &mut [];

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
            VestingInstruction::CreateWindowAccounts{
              pointer_account_seed,
              calendar_account_seed,
              dslope_account_seed,
              calendar_size,
            } => {
              msg!("creating new window accounts");
              Self::process_create_window_accounts(
                vesting_program,
                accounts,
                pointer_account_seed,
                calendar_account_seed,
                dslope_account_seed,
                calendar_size,
              )
            }
            VestingInstruction::PopulateWindowAccounts{
              first_epoch_in_era
            } =>{
              msg!("populating a pointer account");
              Self::process_populate_window_accounts(
                vesting_program,
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
            VestingInstruction::TestUserOnChainVotingPower {
              vesting_account_seed,
              client_voting_power
            } => {
              msg!("testing user on chain voting power function!");
              Self::process_user_voting_power_test(
                vesting_program,
                accounts,
                vesting_account_seed,
                client_voting_power,
              )
            }
            VestingInstruction::TestProtocolOnChainVotingPower {
            } => {
              msg!("testing protocol on chain voting power function!");
              Self::process_protocol_voting_power_test(
                vesting_program,
                accounts,
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
            VestingError::NegativeTime => msg!("timestamp is before Zero Period"),
            VestingError::PointCalendarDesyncronization => msg!("the last filed period on returned point does not match calendar account's"),
            VestingError::InvalidCalHeaderLength => msg!("calendar account's header has an invalid length"),
            VestingError::InvalidPointLength => msg!("point data passed in has an invalid length"),
            VestingError::PointerDslopeMismatch => msg!("the given pointer account does not contain the given dslope account"),
            VestingError::PointerCalendarMismatch => msg!("the given pointer account does not contain the given calendar account"),
            VestingError::PeriodMismatch => msg!("the given first period of the current era does not match the derived value on chain"),
          }
    }
}