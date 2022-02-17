import { PublicKey } from '@solana/web3.js';

//our USDC mint on devnet
export const MINT = new PublicKey('2iFJc4SYu2m64mMRdzcCS9XWp75jTsRoyyRbRMBUKwCC');
//This is the decimals we initiated our USDC mint with
export const DECIMALS = 9; //decimals must match the mint
//seconds in a year
export const SECONDS_IN_YEAR: number = 31_557_600;
//number of seconds in 4 years, our max lock time.
export const MAX_LOCK_TIME: number = SECONDS_IN_YEAR * 4;
//public key of the vesting program on devnet
export const TOKEN_VESTING_PROGRAM_ID = new PublicKey(
  "Ab4b1SjAfndDrPyvr4cAkuuiAWJ37ZBH9pUPYncSVHZh", //devnet
  //"JAenCw7LgYT4RhDQigUNNgoxYNWN7Jafz17GXfYAauPx", //local
);
export const NEPTUNE_MINT = new PublicKey(
  '3SRBwtc6r84HPLBqMNQCLNFFuGCwMc7Aof7Ngiqg9JsX'
);
export const MAX_BOOST = 2.5; 
export const SCHEDULE_SIZE = 18;
export const SECONDS_IN_EPOCH = 604_800;
//export const SECONDS_IN_EPOCH = 300; //five mins. for testing
export const WEEKS_IN_ERA = 26 //start with an epoch of 6 months... see where that gets us
export const ZERO_EPOCH = 0; //this will be the first epoch of our protocol. 1/6/22 0000 GMT
export const ZERO_EPOCH_TS = 1_641_427_200; //# of seconds since the unix zero time and our protocol's zero time (1/6/22 0000 GMT). 
//export const ZERO_EPOCH_TS = 1645127520; //for testing
export const CAL_ENTRY_SIZE = 34;