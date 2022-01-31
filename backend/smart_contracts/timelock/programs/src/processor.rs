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
//use std::str::FromStr;
use num_traits::FromPrimitive;
use spl_token::{instruction::transfer, state::Account};
use core::cell::{RefMut};

use crate::{
    error::VestingError,
    instruction::{VestingInstruction, SCHEDULE_SIZE},
    state::{
      pack_schedules_into_slice, 
      unpack_schedules, 
      VestingSchedule, 
      VestingScheduleHeader,
      DataHeader,
      Point,
      PointerAccountHeader
    },
};

pub struct Processor {}

pub const MAX_BOOST: f32 = 2.5;
//seconds in year * 4 years = seconds in 4 years: our max lock time. 
pub const MAX_LOCK_TIME: u64 = 31557600 * 4;

pub const SECONDS_IN_WEEK: u64 = 604800;
pub const WEEKS_IN_EPOCH: u16 = 26; //6 months

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
          let state_schedule = VestingSchedule {
              release_time: s.release_time,
              amount: s.amount,
          };
          state_schedule.pack_into_slice(&mut account_data[offset..]);
          offset += SCHEDULE_SIZE;
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

    pub fn get_voting_power(
      schedules: Vec<VestingSchedule>,
      clock_sysvar_account: &AccountInfo
    ) -> Result<f32, ProgramError> {
      //setup what we need
      let num_of_schedules = schedules.len() as i32;
      let mut voting_power_vec = Vec::new();
      let clock = Clock::from_account_info(&clock_sysvar_account)?;
      let current_time = clock.unix_timestamp as f32;
      let mut num_eligible_schedules = num_of_schedules;

      //iterate through schedules 
      for s in schedules.iter() {
        let mut amount = s.amount as f32;
        amount = amount / 1000000000.0; //want the human readable amount, not the lamports. 
        let release_time_seconds = s.release_time as f32;
        let remaining_lock_time = release_time_seconds - current_time;

        //calculate voting power for this schedule
        let mut voting_power: f32 = (amount / MAX_LOCK_TIME as f32) * remaining_lock_time;

        //need this so that empty schedules (amount == 0) don't count against user's avg
        //voting power. 
        //Also need this in case tokens in a schedule are claimable. In that situation,
        //current_time > release_time_seconds, so voting power is a negative number. 
        //Claimable tokens shouldn't contribute to voting power, but they shouldn't count 
        //against the user either. just ignore them
        if amount == 0.0 || voting_power < 0.0 {
          num_eligible_schedules -= 1;
          voting_power = 0.0;
        }
        voting_power_vec.push(voting_power);
      }

      //sum the voting powers
      let mut sum = 0.0;
      for one_voting_power in voting_power_vec.iter() {
        sum += one_voting_power;
      }

      //return the average voting power.
      return Ok(sum / num_eligible_schedules as f32)
    }

    pub fn get_epoch(
      ts: u64
    ) -> u16 {
      return (ts / SECONDS_IN_WEEK) as u16
    }

    pub fn process_create_vesting_account(
        vesting_program: &Pubkey,
        accounts: &[AccountInfo],
        vesting_account_seed: [u8; 32],
        data_account_seed: [u8; 32],
        schedules: u32
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
        let data_state_size = DataHeader::LEN + (schedules as usize) * VestingSchedule::LEN;

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
        schedules: Vec<VestingSchedule>,
    ) -> ProgramResult {
        let accounts_iter = &mut accounts.iter();

        let spl_token_account = next_account_info(accounts_iter)?;
        let vesting_account = next_account_info(accounts_iter)?;
        let vesting_token_account = next_account_info(accounts_iter)?;
        let owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
        let owner_token_account = next_account_info(accounts_iter)?; //owner's token account pubkey
        let data_account = next_account_info(accounts_iter)?;
        let mint_account = next_account_info(accounts_iter)?;


        msg!("years to lock is {}", years_to_lock);

        //validate vesting account
        Self::validate_account(vesting_account, vesting_account_seed, vesting_program, "Provided vesting accont is invalid")?;

        //validate data account
        Self::validate_account(data_account, data_account_seed, vesting_program, "Provided data account is invalid")?;

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
        //validate the size of the data account
        let mut data_account_data = data_account.data.borrow_mut();
        if data_account_data.len() != DataHeader::LEN + (schedules.len() * VestingSchedule::LEN) {
            msg!("invalid data account size");
            return Err(ProgramError::InvalidAccountData)
        }
        
        //pack the vesting account key into the data account's data.
        let data_header = DataHeader {
          vesting_account: *vesting_account.key,
          is_initialized: true,
        };
        data_header.pack_into_slice(&mut data_account_data);

        //get and validate the amount of tokens stored in the schedule that need transferring
        let total_amount = Self::get_and_validate_tokens_in_schedule(&schedules)?;
        
        //pack the schedules into the data account's data.
        Self::pack_schedule_vector(schedules, data_account_data)?;
        
        //validate there are enough tokens in the owner's account
        msg!("amount to lock {}", total_amount);
        if Account::unpack(&owner_token_account.data.borrow())?.amount < total_amount {
            msg!("The source token account has insufficient funds.");
            return Err(ProgramError::InsufficientFunds)
        };

        //transfer tokens - user's connected wallet is the authority
        Self::transfer_tokens(
          spl_token_account,
          owner_token_account,
          vesting_token_account,
          owner_account,
          total_amount,
          None
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

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let vesting_account = next_account_info(accounts_iter)?;
      let vesting_token_account = next_account_info(accounts_iter)?;
      let owner_account = next_account_info(accounts_iter)?; //pubkey of vesting account owner
      let owner_token_account = next_account_info(accounts_iter)?;
      let old_data_account = next_account_info(accounts_iter)?;
      let new_data_account = next_account_info(accounts_iter)?;
      let spl_token_account = next_account_info(accounts_iter)?;

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
      let mut old_schedules = unpack_schedules(
        &old_data_packed_state.borrow()[DataHeader::LEN..]
      )?;

      //get the numbers of new schedules and the number of old schedules saved
      let num_of_schedules_to_add = new_schedules.len();
      let num_of_old_schedules = old_schedules.len();
      let new_num_of_schedules = num_of_schedules_to_add + num_of_old_schedules;

      //validate the new data account's size
      let mut new_data_account_data = new_data_account.data.borrow_mut();
      if new_data_account_data.len() != (new_num_of_schedules as usize) * VestingSchedule::LEN + DataHeader::LEN {
          msg!("invalid account size for the new data account");
          return Err(ProgramError::InvalidAccountData)
      }

      //pack the vesting account key into the new data account's data.
      let data_header = DataHeader {
        vesting_account: *vesting_account.key,
        is_initialized: true,
      };
      data_header.pack_into_slice(&mut new_data_account_data);


      //validate the token amount in the new schedule we passed in.
      let tokens_in_new_schedule = Self::get_and_validate_tokens_in_schedule(&new_schedules)?;
      if tokens_in_new_schedule != tokens_to_add {
        msg!("tokens in the schedule does not match the tokens to transfer that we passed in");
        return Err(ProgramError::InvalidArgument)
      }

      //create an all schedules vector that contains all of our schedules.
      //Note this operation mutates new_schedules and leaves it empty.
      let all_schedules = &mut old_schedules;
      all_schedules.append(&mut new_schedules);

      //make sure the new total amount of tokens in the token account doesn't result in an
      //overflow. We don't actually need the new_total_tokens var for anything here
      let _new_total_tokens = Self::get_and_validate_tokens_in_schedule(&all_schedules)?;

      //pack the all schedules vector into the new data account's data.
      Self::pack_schedule_vector(all_schedules.to_vec(), new_data_account_data)?;

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

      //make sure the owner has enough tokens for the transfer.
      msg!("tokens to add {}", tokens_to_add);
      if Account::unpack(&owner_token_account.data.borrow())?.amount < tokens_to_add {
          msg!("The source token account has insufficient funds.");
          return Err(ProgramError::InsufficientFunds)
      };

      //transfer tokens
      Self::transfer_tokens(
        spl_token_account,
        owner_token_account,
        vesting_token_account,
        owner_account,
        tokens_to_add,
        None
      )?;

      //transfer the rent lamports from the old data account back to the vesting account owner.
      //this will effectively close the old data account. 
      msg!("closing the old data account");
      **owner_account.lamports.borrow_mut() = owner_account.lamports()
        .checked_add(old_data_account.lamports())
        .ok_or(VestingError::AmountOverflow)?;
      **old_data_account.lamports.borrow_mut() = 0;

      //also wipe the data from the old data account, since we don't need it anymore. 
      //good practice according to paulx
      *old_data_account.data.borrow_mut() = &mut [];
          
      Ok(())
    }

    pub fn process_voting_power_test(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      vesting_account_seed: [u8; 32],
      client_voting_power: f32,
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
      let voting_power = Self::get_voting_power(schedules, clock_sysvar_account)?;

      //casting as a u64 will take the integer value of the voting power and ignore the decimals
      msg!("voting power from client is {}", client_voting_power as u64);
      msg!("voting power from on chain function is {}", voting_power as u64);

      Ok(())
    }

    pub fn process_create_calendar_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      calendar_seed: [u8; 32],
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;

      //calculate rent
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      let account_size = Point::LEN;
      let rent_to_pay = rent.minimum_balance(account_size);
      msg!("the calendar account will cost {} lamports to initialize", rent_to_pay);

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
      let account_size = (16 * WEEKS_IN_EPOCH) as usize;
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
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let calendar_account = next_account_info(accounts_iter)?;
      let dslope_account = next_account_info(accounts_iter)?;

      let pointer_header = PointerAccountHeader{
        calendar_account: *calendar_account.key,
        dslope_account: *dslope_account.key,
        is_initialized: true
      };
      let mut pointer_data = pointer_account.data.borrow_mut();

      //don't need a slice since this is all the data that will be in the 
      //pointer account
      pointer_header.pack_into_slice(&mut pointer_data);

      Ok(())
    }

    
    pub fn process_create_new_calendar_account(
      vesting_program: &Pubkey,
      accounts: &[AccountInfo],
      new_calendar_account_seed: [u8; 32],
      bytes_to_add: u32
    ) -> ProgramResult {

      //get accounts
      let accounts_iter = &mut accounts.iter();
      let fee_payer_account = next_account_info(accounts_iter)?;
      let pointer_account = next_account_info(accounts_iter)?;
      let new_cal_account = next_account_info(accounts_iter)?;
      //don't use this now, but may for validation later
      let old_cal_account = next_account_info(accounts_iter)?;
      let system_program = next_account_info(accounts_iter)?;
      let rent_sysvar_account = next_account_info(accounts_iter)?;

      //get some info from the old header
      let mut pointer_data = pointer_account.data.borrow_mut();
      let old_header = PointerAccountHeader::unpack(&pointer_data)?;

      //create a new pointer account header with the new cal account. 
      let new_header = PointerAccountHeader{
        calendar_account: *new_cal_account.key,
        dslope_account: old_header.dslope_account,
        is_initialized: old_header.is_initialized
      };

      //save the new header to the pointer account.
      new_header.pack_into_slice(&mut pointer_data);

      //calculate rent
      let old_cal_size = old_cal_account.data_len();
      let new_cal_size = old_cal_size + bytes_to_add as usize;
      let rent = Rent::from_account_info(rent_sysvar_account)?;
      let rent_to_pay = rent.minimum_balance(new_cal_size);
      msg!("the pointer account will cost {} lamports to initialize", rent_to_pay);

      //create the new calendar account
      Self::create_new_account(
        fee_payer_account,
        new_cal_account,
        new_calendar_account_seed,
        rent_to_pay,
        new_cal_size as u64,
        vesting_program,
        system_program
      )?;

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
                msg!("Instruction: Init");
                Self::process_create_vesting_account(
                  vesting_program, 
                  accounts, 
                  vesting_account_seed, 
                  data_account_seed, 
                  number_of_schedules,
                )
            }
            VestingInstruction::Unlock { vesting_account_seed } => {
                msg!("Instruction: Unlock");
                Self::process_unlock(vesting_program, accounts, vesting_account_seed)
            }
            VestingInstruction::PopulateVestingAccount {
                vesting_account_seed,
                data_account_seed,
                destination_token_address,
                years_to_lock,
                schedules,
            } => {
                msg!("Instruction: Create Schedule");
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
              msg!("Instruction: Init new data account");
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
            } => {
              Self::process_create_calendar_account(
                vesting_program,
                accounts,
                calendar_account_seed,
              )
            }
            VestingInstruction::CreateDslopeAccount{
              dslope_account_seed
            } => {
              Self::process_create_dslope_account(
                vesting_program,
                accounts,
                dslope_account_seed
              )
            }
            VestingInstruction::CreatePointerAccount{
              pointer_account_seed
            } => {
              Self::process_create_pointer_account(
                vesting_program,
                accounts,
                pointer_account_seed
              )
            }
            VestingInstruction::PopulatePointerAccount{} =>{
              Self::process_populate_pointer_account(
                accounts
              )
            }
            VestingInstruction::CreateNewCalendarAccount{
              new_calendar_account_seed,
              bytes_to_add
            } => {
              msg!("creating a new calendar account");
              Self::process_create_new_calendar_account(
                vesting_program,
                accounts,
                new_calendar_account_seed,
                bytes_to_add
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
