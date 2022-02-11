use crate::{
  error::VestingError,
  state::VestingSchedule,
};

use solana_program::{
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    program_pack::Pack
};

use std::convert::TryInto;
use std::mem::size_of;

#[cfg(feature = "fuzz")]
use arbitrary::Arbitrary;

#[cfg(feature = "fuzz")]
impl Arbitrary for VestingInstruction {
    fn arbitrary(u: &mut arbitrary::Unstructured<'_>) -> arbitrary::Result<Self> {
        let seed: [u8; 32] = u.arbitrary()?;
        let choice = u.choose(&[0, 1, 2, 3])?;
        match choice {
            0 => {
                let number_of_schedules = u.arbitrary()?;
                return Ok(Self::Init {
                    seed,
                    number_of_schedules,
                });
            }
            1 => {
                let schedules: [VestingSchedule; 10] = u.arbitrary()?;
                let key_bytes: [u8; 32] = u.arbitrary()?;
                let mint_address: Pubkey = Pubkey::new(&key_bytes);
                let key_bytes: [u8; 32] = u.arbitrary()?;
                let destination_token_address: Pubkey = Pubkey::new(&key_bytes);
                return Ok(Self::Create {
                    seed,
                    mint_address,
                    destination_token_address,
                    schedules: schedules.to_vec(),
                });
            }
            2 => return Ok(Self::Unlock { seed }),
            _ => return Ok(Self::ChangeDestination { seed }),
        }
    }
}


#[cfg_attr(feature = "fuzz", derive(Arbitrary))]
/*
#[repr(C)]
#[derive(Clone, Debug, PartialEq)]
pub struct Schedule {
    // Schedule release time in unix timestamp
    pub release_time: u64,
    pub amount: u64,
}
*/

#[repr(C)]
#[derive(Clone, Debug, PartialEq)]
pub enum VestingInstruction {
    /// Initializes an empty program account for the token_vesting program
    ///
    /// Accounts expected by this instruction:
    ///
    ///   * Single owner
    ///   0. `[]` The system program account
    ///   1. `[]` The sysvar Rent account
    ///   2. `[signer]` The fee payer account
    ///   3. `[writable]` The vesting account
    ///   4. '[writable]' The data account
    CreateVestingAccount {
        // The seed used to derive the vesting accounts address
        vesting_account_seed: [u8; 32],
        // The seed used to derive the data account address
        data_account_seed: [u8; 32],
        // The number of release schedules for this contract to hold
        number_of_schedules: u32,
    },
    /// Creates a new vesting schedule contract
    ///
    /// Accounts expected by this instruction:
    ///
    ///   * Single owner
    ///   0. `[]` The spl-token program account
    ///   1. `[writable]` The vesting account
    ///   2. `[writable]` The vesting spl-token account
    ///   3. `[signer]` The source spl-token account owner
    ///   4. `[writable]` The source spl-token account
    ///   5. `[writable]` the data account we're creating
    ///   6. `[]` the mint address of the tokens we're locking
    PopulateVestingAccount {
        vesting_account_seed: [u8; 32],
        data_account_seed: [u8; 32],
        destination_token_address: Pubkey,
        years_to_lock:f32,
        schedules: Vec<VestingSchedule>,
    },
    /// Unlocks a simple vesting contract (SVC) - can only be invoked by the program itself
    /// Accounts expected by this instruction:
    ///
    ///   * Single owner
    ///   0. `[]` The spl-token program account
    ///   1. `[]` The clock sysvar account
    ///   1. `[writable]` The vesting account
    ///   2. `[writable]` The vesting spl-token account
    ///   3. `[writable]` The destination spl-token account
    ///   4. `[writable]` The vesting account's data account
    Unlock { vesting_account_seed: [u8; 32] },

    ///   * Single owner
    ///   1. `[writable]` vesting account ID
    ///   2. `[signer]` The vesting account account owner
    ///   3. `[]` the system program account key
    ///   4. `[]` the rent sysvar account. 
    ///   5. `[writable]` the old data account
    ///   6. `[writable]` the new data account
    CreateNewDataAccount {
      vesting_account_seed: [u8; 32],
      new_data_account_seed: [u8; 32],
      schedules: Vec<VestingSchedule>, 
    },


    ///   1. `[writable]` vesting account ID
    ///   2. `[writable]` vesting account's token account
    ///   3. `[signer]` The vesting account owner
    ///   4. `[writable]` vesting account owner's token account.
    ///   5. `[writable]` the old data account
    ///   6. `[writable]` the new data account
    ///   7. `[]` token program ID
    PopulateNewDataAccount { 
      vesting_account_seed: [u8; 32],
      new_data_account_seed: [u8; 32],
      tokens_to_add: u64,
      schedules: Vec<VestingSchedule>, 
    },

    //TODO - will the seed actually be this long?
    CreateCalendarAccount{
      calendar_account_seed: [u8; 32],
      account_size: u64
    },

    PopulateCalendarAccount{
      first_epoch_in_era: u16
    },

    CreatePointerAccount{
      pointer_account_seed: [u8; 32],
    },

    PopulatePointerAccount{
      first_epoch_in_era: u16
    },

    //TODO - will the seed actually be this long?
    CreateDslopeAccount{
      dslope_account_seed: [u8; 32],
    },     
    
    TransferCalendarData{
      new_calendar_account_seed: [u8; 32],
    },

    // 1. [signer] owner's account
    // 2. [] vesting account
    TestOnChainVotingPower {
      vesting_account_seed: [u8; 32],
      client_voting_power:u64,
    },
}

impl VestingInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        use VestingError::InvalidInstruction;
        let (&tag, rest) = input.split_first().ok_or(InvalidInstruction)?;
        Ok(match tag {
            //create a new vesting account + data account
            0 => {
                let vesting_account_seed: [u8; 32] = rest
                    .get(..32)
                    .and_then(|slice| slice.try_into().ok())
                    .unwrap();
                let data_account_seed: [u8; 32] = rest
                    .get(32..64)
                    .and_then(|slice| slice.try_into().ok())
                    .unwrap();
                let number_of_schedules = rest
                    .get(64..68)
                    .and_then(|slice| slice.try_into().ok())
                    .map(u32::from_le_bytes)
                    .ok_or(InvalidInstruction)?;
                Self::CreateVestingAccount {
                    vesting_account_seed,
                    data_account_seed,
                    number_of_schedules,
                }
            }
            //populate the vesting account and data account
            1 => {
                let vesting_account_seed: [u8; 32] = rest
                    .get(..32)
                    .and_then(|slice| slice.try_into().ok())
                    .unwrap();
                let data_account_seed: [u8; 32] = rest
                    .get(32..64)
                    .and_then(|slice| slice.try_into().ok())
                    .unwrap();
                let destination_token_address = rest
                    .get(64..96)
                    .and_then(|slice| slice.try_into().ok())
                    .map(Pubkey::new)
                    .ok_or(InvalidInstruction)?;
                let years_to_lock = rest
                    .get(96..100)
                    .and_then(|slice| slice.try_into().ok())
                    .map(f32::from_le_bytes)
                    .ok_or(InvalidInstruction)?;
                let number_of_schedules = rest[100..].len() / VestingSchedule::LEN;
                let mut schedules: Vec<VestingSchedule> = Vec::with_capacity(number_of_schedules);
                let mut offset = 100;
                for _ in 0..number_of_schedules {
                    let release_time = rest
                        .get(offset..offset + 8)
                        .and_then(|slice| slice.try_into().ok())
                        .map(u64::from_le_bytes)
                        .ok_or(InvalidInstruction)?;
                    let amount = rest
                        .get(offset + 8..offset + 16)
                        .and_then(|slice| slice.try_into().ok())
                        .map(u64::from_le_bytes)
                        .ok_or(InvalidInstruction)?;
                    let creation_epoch = rest
                      .get(offset + 16..offset + 18)
                      .and_then(|slice| slice.try_into().ok())
                      .map(u16::from_le_bytes)
                      .ok_or(InvalidInstruction)?;
                    offset += VestingSchedule::LEN;
                    schedules.push(VestingSchedule {
                        release_time,
                        amount,
                        creation_epoch,
                    })
                }
                Self::PopulateVestingAccount {
                    vesting_account_seed,
                    data_account_seed,
                    destination_token_address,
                    years_to_lock,
                    schedules,
                }
            }
            //unlock tokesns
            2 => {
                let vesting_account_seed: [u8; 32] = rest
                    .get(..32)
                    .and_then(|slice| slice.try_into().ok())
                    .unwrap();
                    Self::Unlock { vesting_account_seed }
            }
            //initialize new data account
            3 => {
              //todo - add new data account seed to this + change var names to make it clearer
                let vesting_account_seed: [u8; 32] = rest
                  .get(..32)
                  .and_then(|slice| slice.try_into().ok())
                  .unwrap();
                let new_data_account_seed: [u8; 32] = rest
                  .get(32..64)
                  .and_then(|slice| slice.try_into().ok())
                  .unwrap();
                let number_of_schedules = rest[64..].len() / VestingSchedule::LEN;
                let mut schedules: Vec<VestingSchedule> = Vec::with_capacity(number_of_schedules);
                let mut offset = 64;
                for _ in 0..number_of_schedules {
                    let release_time = rest
                        .get(offset..offset + 8)
                        .and_then(|slice| slice.try_into().ok())
                        .map(u64::from_le_bytes)
                        .ok_or(InvalidInstruction)?;
                    let amount = rest
                        .get(offset + 8..offset + 16)
                        .and_then(|slice| slice.try_into().ok())
                        .map(u64::from_le_bytes)
                        .ok_or(InvalidInstruction)?;
                    let creation_epoch = rest
                        .get(offset + 16..offset + 18)
                        .and_then(|slice| slice.try_into().ok())
                        .map(u16::from_le_bytes)
                        .ok_or(InvalidInstruction)?;
                    offset += VestingSchedule::LEN;
                    schedules.push(VestingSchedule {
                        release_time,
                        amount,
                        creation_epoch,
                    })
                }
                  Self::CreateNewDataAccount {
                    vesting_account_seed,
                    new_data_account_seed,
                    schedules,
                }
            }
            //populate new data account
            4 => {
              let vesting_account_seed: [u8; 32] = rest
                .get(..32)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              let new_data_account_seed: [u8; 32] = rest
                .get(32..64)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              let tokens_to_add = rest
                .get(64..72)
                .and_then(|slice| slice.try_into().ok())
                .map(u64::from_le_bytes)
                .ok_or(InvalidInstruction)?;
              let number_of_schedules = rest[72..].len() / VestingSchedule::LEN;
              let mut schedules: Vec<VestingSchedule> = Vec::with_capacity(number_of_schedules);
              let mut offset = 72;
              for _ in 0..number_of_schedules {
                  let release_time = rest
                      .get(offset..offset + 8)
                      .and_then(|slice| slice.try_into().ok())
                      .map(u64::from_le_bytes)
                      .ok_or(InvalidInstruction)?;
                  let amount = rest
                      .get(offset + 8..offset + 16)
                      .and_then(|slice| slice.try_into().ok())
                      .map(u64::from_le_bytes)
                      .ok_or(InvalidInstruction)?;
                    let creation_epoch = rest
                      .get(offset + 16..offset + 18)
                      .and_then(|slice| slice.try_into().ok())
                      .map(u16::from_le_bytes)
                      .ok_or(InvalidInstruction)?;
                  offset += VestingSchedule::LEN;
                  schedules.push(VestingSchedule {
                      release_time,
                      amount,
                      creation_epoch,
                  })
              }
                Self::PopulateNewDataAccount {
                  vesting_account_seed,
                  new_data_account_seed,
                  tokens_to_add,
                  schedules,
              }
            }
            //create a calendar account
            5 => {
              let calendar_account_seed: [u8; 32] = rest
                .get(..32)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              let account_size = rest
                .get(32..40)
                .and_then(|slice| slice.try_into().ok())
                .map(u64::from_le_bytes)
                .ok_or(InvalidInstruction)?;
              Self::CreateCalendarAccount{
                calendar_account_seed,
                account_size,
              }              
            }
            //create a calendar account
            6 => {
              let first_epoch_in_era = rest
                .get(0..2)
                .and_then(|slice| slice.try_into().ok())
                .map(u16::from_le_bytes)
                .ok_or(InvalidInstruction)?;
              Self::PopulateCalendarAccount{
                first_epoch_in_era
              }              
            }
            //create a dslope account
            7 => {
              let dslope_account_seed: [u8; 32] = rest
                .get(..32)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              Self::CreateDslopeAccount{
                dslope_account_seed,
              }              
            }
            //create a pointer account
            8 => {
              let pointer_account_seed: [u8; 32] = rest
                .get(..32)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              Self::CreatePointerAccount{
                pointer_account_seed,
              }              
            }
            //populate a pointer account
            9 => {
              let first_epoch_in_era = rest
                .get(0..2)
                .and_then(|slice| slice.try_into().ok())
                .map(u16::from_le_bytes)
                .ok_or(InvalidInstruction)?;
              Self::PopulatePointerAccount{
                first_epoch_in_era
              }
            }
            //create a new calendar account
            10 => {
              let new_calendar_account_seed: [u8; 32] = rest
                .get(..32)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              Self::TransferCalendarData{
                new_calendar_account_seed,
              } 
            }
            //test on chain voting power   
            23 => {
              let vesting_account_seed: [u8; 32] = rest
                .get(..32)
                .and_then(|slice| slice.try_into().ok())
                .unwrap();
              let client_voting_power = rest
                .get(32..40)
                .and_then(|slice| slice.try_into().ok())
                .map(u64::from_le_bytes)
                .ok_or(InvalidInstruction)?;
              Self::TestOnChainVotingPower {
                vesting_account_seed,
                client_voting_power,
              }
            }
            _ => {
                msg!("Unsupported tag");
                return Err(InvalidInstruction.into());
            }


        })
    }

    pub fn pack(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(size_of::<Self>());
        match self {
            &Self::CreateVestingAccount {
                vesting_account_seed,
                data_account_seed,
                number_of_schedules,
            } => {
                buf.push(0);
                buf.extend_from_slice(&vesting_account_seed);
                buf.extend_from_slice(&data_account_seed);
                buf.extend_from_slice(&number_of_schedules.to_le_bytes())
            }
            Self::PopulateVestingAccount {
                vesting_account_seed,
                data_account_seed,
                destination_token_address,
                years_to_lock,
                schedules,
            } => {
                buf.push(1);
                buf.extend_from_slice(vesting_account_seed);
                buf.extend_from_slice(data_account_seed);
                buf.extend_from_slice(&destination_token_address.to_bytes());
                buf.extend_from_slice(&years_to_lock.to_le_bytes());
                for s in schedules.iter() {
                    buf.extend_from_slice(&s.release_time.to_le_bytes());
                    buf.extend_from_slice(&s.amount.to_le_bytes());
                    buf.extend_from_slice(&s.creation_epoch.to_le_bytes());
                }
            }
            &Self::Unlock { vesting_account_seed } => {
                buf.push(2);
                buf.extend_from_slice(&vesting_account_seed);
            }
            Self::CreateNewDataAccount {
              vesting_account_seed,
              new_data_account_seed,
              schedules,
            } => {
              buf.push(3);
              buf.extend_from_slice(vesting_account_seed);
              buf.extend_from_slice(new_data_account_seed);
              for s in schedules.iter() {
                  buf.extend_from_slice(&s.release_time.to_le_bytes());
                  buf.extend_from_slice(&s.amount.to_le_bytes());
                  buf.extend_from_slice(&s.creation_epoch.to_le_bytes());
              }
            }
            Self::PopulateNewDataAccount {
              vesting_account_seed,
              new_data_account_seed,
              tokens_to_add,
              schedules,
            } => {
              buf.push(4);
              buf.extend_from_slice(vesting_account_seed);
              buf.extend_from_slice(new_data_account_seed);
              buf.extend_from_slice(&tokens_to_add.to_le_bytes());
              for s in schedules.iter() {
                  buf.extend_from_slice(&s.release_time.to_le_bytes());
                  buf.extend_from_slice(&s.amount.to_le_bytes());
                  buf.extend_from_slice(&s.creation_epoch.to_le_bytes());
              }
            }
            Self::CreateCalendarAccount{
              calendar_account_seed,
              account_size
            } => {
              buf.push(5);
              buf.extend_from_slice(calendar_account_seed);
              buf.extend_from_slice(&account_size.to_le_bytes());
            }
            Self::PopulateCalendarAccount{
              first_epoch_in_era
            } => {
              buf.push(6);
              buf.extend_from_slice(&first_epoch_in_era.to_le_bytes());
            }
            Self::CreateDslopeAccount{
              dslope_account_seed
            } => {
              buf.push(6);
              buf.extend_from_slice(dslope_account_seed);
            }
            Self::CreatePointerAccount{
              pointer_account_seed
            } => {
              buf.push(7);
              buf.extend_from_slice(pointer_account_seed);
            }
            Self::PopulatePointerAccount{
              first_epoch_in_era,
            } => {
              buf.push(8);
              buf.extend_from_slice(&first_epoch_in_era.to_le_bytes());
            }
            Self::TransferCalendarData{
              new_calendar_account_seed,
            } => {
              buf.push(9);
              buf.extend_from_slice(new_calendar_account_seed);
            }
            Self::TestOnChainVotingPower{
              vesting_account_seed,
              client_voting_power,
            } => {
              buf.push(23);
              buf.extend_from_slice(vesting_account_seed);
              buf.extend_from_slice(&client_voting_power.to_le_bytes());
            }
        };
        buf
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_instruction_packing() {
        let mint_address = Pubkey::new_unique();
        let destination_token_address = Pubkey::new_unique();

        let original_create = VestingInstruction::Create {
            seed: [50u8; 32],
            schedules: vec![VestingSchedule {
                amount: 42,
                release_time: 250,
            }],
            mint_address: mint_address.clone(),
            destination_token_address,
        };
        let packed_create = original_create.pack();
        let unpacked_create = VestingInstruction::unpack(&packed_create).unwrap();
        assert_eq!(original_create, unpacked_create);

        let original_unlock = VestingInstruction::Unlock { seed: [50u8; 32] };
        assert_eq!(
            original_unlock,
            VestingInstruction::unpack(&original_unlock.pack()).unwrap()
        );

        let original_init = VestingInstruction::Init {
            number_of_schedules: 42,
            seed: [50u8; 32],
        };
        assert_eq!(
            original_init,
            VestingInstruction::unpack(&original_init.pack()).unwrap()
        );

        let original_change = VestingInstruction::ChangeDestination { seed: [50u8; 32] };
        assert_eq!(
            original_change,
            VestingInstruction::unpack(&original_change.pack()).unwrap()
        );
    }
}
