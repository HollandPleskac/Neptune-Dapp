use num_derive::FromPrimitive;
use solana_program::{decode_error::DecodeError, program_error::ProgramError};
use thiserror::Error;

/// Errors that may be returned by the Token vesting program.
#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum VestingError {
    // Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
    //too much money!!!
    #[error("amount overflow")]
    AmountOverflow,

}

///Errors that may be returned involving the calendar
#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum CalendarError {
    //failed to unpack the calendar
    #[error("failed to unpack calendar")]
    InvalidCalendar,
    //tried to add a key that already exists
    #[error("attempted to add a key that already exists")]
    KeyAlreadyExists,
    //key does not exist in the calendar
    #[error("attempted to remove a key that does not exist")]
    KeyNotFoundInAccount,
}

///Errors that may be returned involving the calendar
#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum PointError {
    //failed to unpack the calendar
    #[error("point data passed in is too long")]
    InvalidPointLength,
}

impl From<VestingError> for ProgramError {
    fn from(e: VestingError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl From<CalendarError> for ProgramError {
  fn from(e: CalendarError) -> Self {
      ProgramError::Custom(e as u32)
  }
}

impl From<PointError> for ProgramError {
  fn from(e: PointError) -> Self {
      ProgramError::Custom(e as u32)
  }
}

impl<T> DecodeError<T> for VestingError {
    fn type_of() -> &'static str {
        "VestingError"
    }
}
