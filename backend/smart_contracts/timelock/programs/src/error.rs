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
    //failed to unpack point data
    #[error("point data passed in has an invalid length")]
    InvalidPointLength,
    //failed to unpack point data
    #[error("timestamp is before Zero Period")]
    NegativeTime,
    //calendar account data is invalid
    #[error("the last filed period on returned point does not match calendar account's")]
    PointCalendarDesyncronization,
    //cal header has invalid length
    #[error("calendar account's header has an invalid length")]
    InvalidCalHeaderLength,
    #[error("the given pointer account does not contain the given dslope account")]
    PointerDslopeMismatch,
    #[error("the given pointer account does not contain the given calendar account")]
    PointerCalendarMismatch,
    #[error("the given first period of the current era does not match the derived value on chain")]
    PeriodMismatch,

    

}


impl From<VestingError> for ProgramError {
    fn from(e: VestingError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for VestingError {
    fn type_of() -> &'static str {
        "Vesting Error"
    }
}
