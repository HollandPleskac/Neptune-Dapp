// @ts-nocheck
import BN from 'bn.js';
import assert from 'assert';
import nacl from 'tweetnacl';
import * as bip32 from 'bip32';
import {
  Keypair,
  Account,
  Connection,
  Transaction,
  TransactionInstruction,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SendOptions,
} from '@solana/web3.js';
import { Schedule, Point } from './state';
import {getAccountInfo} from './async'
import {
  CAL_ENTRY_SIZE,
  MAX_BOOST, 
  MAX_LOCK_TIME, 
  SCHEDULE_SIZE,
  SECONDS_IN_WEEK,
  WEEKS_IN_ERA,
  ZERO_EPOCH,
  TOKEN_VESTING_PROGRAM_ID,
  NEPTUNE_MINT
} from './const';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import next from 'next';
import { error } from 'console';

export async function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey,
): Promise<PublicKey> {
  return (
    await PublicKey.findProgramAddress(
      [
        walletAddress.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
  )[0];
}

export function getBoost(
  yearsToLock: number,
  amountToLock: number
) {
  const yearBoost = yearsToLock * 0.25;
  const amountBoost = (amountToLock / 10_000) * 0.25;
  var boost = 1 + yearBoost + amountBoost
  if (boost > MAX_BOOST) {
    var boost = MAX_BOOST
  }
  return boost;
};

export class Numberu64 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 8) {
      return b;
    }
    assert(b.length < 8, 'Numberu64 too large');

    const zeroPad = Buffer.alloc(8);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu64 from Buffer representation
   */
  static fromBuffer(buffer): any {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

export class Numberu32 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 4) {
      return b;
    }
    assert(b.length < 4, 'Numberu32 too large');

    const zeroPad = Buffer.alloc(4);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu32 from Buffer representation
   */
  static fromBuffer(buffer): any {
    assert(buffer.length === 4, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

export class Numberi128 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 16) {
      return b;
    }
    assert(b.length < 16, 'Numberu32 too large');

    const zeroPad = Buffer.alloc(16);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu32 from Buffer representation
   */
  static fromBuffer(buffer): any {
    assert(buffer.length === 16, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

export class Numberu16 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 2) {
      return b;
    }
    assert(b.length < 2, 'Numberu32 too large');

    const zeroPad = Buffer.alloc(2);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a Numberu16 from Buffer representation
   */
  static fromBuffer(buffer): any {
    assert(buffer.length === 2, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

// Connection

const ENDPOINTS = {
  mainnet: 'https://solana-api.projectserum.com',
  devnet: 'https://devnet.solana.com',
};

export const connection = new Connection(ENDPOINTS.devnet);

// For accounts imported from Sollet.io

export const getDerivedSeed = (seed: Buffer): Uint8Array => {
  const derivedSeed = bip32.fromSeed(seed).derivePath(`m/501'/0'/0/0`)
    .privateKey;
  return nacl.sign.keyPair.fromSeed(derivedSeed).secretKey;
};

export const getAccountFromSeed = (seed: Buffer): Account => {
  const derivedSeed = bip32.fromSeed(seed).derivePath(`m/501'/0'/0/0`)
    .privateKey;
  return new Account(nacl.sign.keyPair.fromSeed(derivedSeed).secretKey);
};

export const ASSOCIATED_TOKEN_PROGRAM_ID: PublicKey = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
export const generateRandomSeed = () => {
  // Generate a random seed
  let seed = '';
  for (let i = 0; i < 64; i++) {
    seed += Math.floor(Math.random() * 10);
  }
  return seed;
};

export function getUserVotingPower(
  schedulesRaw: Buffer,
  numOfSchedules: number,
): number {
  //setup
  let i: number
  let votingPowerArray = []
  let offset = 0;
  let currentTimeSeconds = new Date().getTime() / 1000;
  let [currentEpoch, currentEpochTs] = getEpochFromTs(currentTimeSeconds);

  //iterate through schedules to calculate voting power for each one. 
  for (i=0; i < numOfSchedules; i++) {
    //get what we need to calculate voting power
    let oneRawSchedule = schedulesRaw.slice(offset, offset + SCHEDULE_SIZE);
    let oneSchedule = Schedule.fromBuffer(oneRawSchedule);
    let releaseTimeSeconds = getScheduleReleaseDate(oneSchedule).getTime() / 1000;
    let [releaseEpoch, releaseEpochTs] = getEpochFromTs(releaseTimeSeconds);
    let remainingLockTime = releaseEpochTs - currentTimeSeconds;
    let creationEpoch = oneSchedule.creationEpoch.toNumber();
    let creationTs = creationEpoch * SECONDS_IN_WEEK;
    //want the amount in lamports, since that's how the on chain slope and bias are found
    let amount = getScheduleAmount(oneSchedule) * 1000000000;

    //get the slope and bias. slope is rounded, since thats how we calculate the slope on chain.
    let slope = Math.floor(amount / MAX_LOCK_TIME);
    let bias = slope * (releaseEpochTs - creationTs);
    
    console.log("user bias", bias);
    console.log("user slope", slope);
    console.log("remaining lock time", remainingLockTime)
    console.log("currentTime seconds", currentEpochTs);
    console.log("creation ts", creationTs);
    
    let votingPower = bias - (slope * (currentEpochTs - creationTs))
    //votingPower = Math.floor(votingPower / 1000000000) //divide by lamport number to make it human readable
    console.log("first user voting power", votingPower)

    //this happens if the tokens in a schedule are claimable (ie, currentTimeSeconds > releaseTimeSeconds).
    //Those shouldn't contribute to voting power, but they shouldn't count against the user 
    //either. Just ignore them.
    if (votingPower < 0) {
      votingPower = 0
    }

    votingPowerArray.push(votingPower)
    offset += SCHEDULE_SIZE
  }

  //sum the voting powers stored in the voting power array
  let sum = 0
  for (i=0; i< numOfSchedules; i++) {
    sum += votingPowerArray[i];
  }

  //calculate the average voting power. use eligible schedules instead of total schedules.
  //what was I thinking? Why would we average a user's voting power instead of just summing
  //the voting power of each individual schedules?
  //const avgVotingPower = sum / numOfEligibleSchedules;

  //divide the sum by the lamport number to make it more human readable. 
  console.log("total user voting power", Math.floor(sum / 1000000000))
  return Math.floor(sum / 1000000000)
}

export function getScheduleAmount(
  oneSchedule: Schedule
): number {
  //get the token amount such that it isn't in lamports
  return oneSchedule.amount.toNumber() / 1000000000
} 

export function getScheduleReleaseDate(
  oneSchedule: Schedule
): Date {
  //release time is stored in seconds. Need to conver to milliseconds to create a date object. 
  let releaseTimeInMilliseconds = oneSchedule.releaseTime.toNumber() * 1000;
  return new Date(releaseTimeInMilliseconds);
}

export function getDataAccount(
  vestingAccountData: Buffer
): PublicKey {
  const dataAccountRaw = vestingAccountData.slice(64,96);
  return new PublicKey(dataAccountRaw);
}

export async function deriveAccountInfo(
  seedWord: any, 
  programId: PublicKey,
  mintAddress: PublicKey) 
  {
  // Find the non reversible public key for a vesting contract via the seed
  seedWord = seedWord.slice(0, 31);
  const [derivedAccountKey, bump] = await PublicKey.findProgramAddress(
    [seedWord],
    programId,
  );

  const derivedTokenAccountKey = await findAssociatedTokenAddress(
    derivedAccountKey,
    mintAddress,
  );
  
  //add the bump as the last element of the seed
  let bumpBuf = Buffer.from(bump.toString(16), 'hex')
  let buffers = [seedWord, bumpBuf]
  seedWord = Buffer.concat(buffers);
  
  //seedWord = Buffer.from(seedWord.toString('hex') + bump.toString(16), 'hex');
  return [derivedAccountKey, derivedTokenAccountKey, seedWord]
}

export async function getAccountInfo(
  accountKey: PublicKey,
  connection: Connection,
): Promise<AccountInfo<Buffer> | null> {
  const check_existing = await connection.getAccountInfo(accountKey, 'confirmed');
  return check_existing;
}


export function getMintDecimals(
  mintInfo: AccountInfo
) {
  const mintData = mintInfo.data;
  //source on where to find decimals in the mint data
  //https://github.com/solana-labs/solana-program-library/blob/08d9999f997a8bf38719679be9d572f119d0d960/token/program/src/state.rs#L16
  //source for the size of the decimal data
  //https://github.com/solana-labs/solana-program-library/blob/08d9999f997a8bf38719679be9d572f119d0d960/token/program/src/state.rs#L59
  const decimalsRaw = mintData.slice(44, 45);
  return decimalsRaw[0];
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Sign transaction

export const signTransactionInstructions = async (
  // sign and send transaction
  connection: Connection,
  feePayer: PublicKey,
  txInstructions: Array<TransactionInstruction>,
): Promise<string> => {
  const tx = new Transaction();
  console.log("new transaction created");
  tx.feePayer = feePayer;
  tx.add(...txInstructions);
  const {blockhash} = await connection.getRecentBlockhash();
  tx.recentBlockhash = blockhash;
  const options: SendOptions = {
    skipPreflight: true
  };
  try {
    const { signature } = await window.solana.signAndSendTransaction(tx, options);
    console.log("transaction", tx);
    console.log("signature", signature);
    //return await connection.confirmTransaction(signature);
  } catch(err) {
    console.log(err);
    console.log("Error:" + JSON.stringify(err));
  }
};

//adds the ixs in sourceIx array to destIx array
export function transferInstructions(
  sourceIx,
  destIx
): Array<TransactionInstructions> {
  sourceIx.forEach((ix) => {
    destIx.push(ix)
  })
  return destIx
}

//change left_ts to a buffer that's 32 bytes long so it'll work as the seed phrase in
//the create account function I've already got in the rust program. 
export function getPointerSeed(
  ts: number
): Uint8Array {
  let ts_arr = Array.from(String(ts))
  while (ts_arr.length < 32 ) {
    ts_arr.push(0);
  }
  //ts_arr = Buffer.from(ts_arr.toString('hex'), 'hex');
  return Uint8Array.from(ts_arr)
}

export function getZeroSchedule(): Schedule {
  return new Schedule(
    new Numberu64(0),
    new Numberu64(0),
  )
}

//find out when the window start and window end is. 
export async function getWindowPointerAccountsAndData(
  currentEpoch: number,
  currentEpochTs: number,
  currentEraStartTs: number,
  connection: Connection,
): Promise<Array<any>> { 
  //check to see if there is a pointer account for the given era start timestamp.
  const seed_word = getPointerSeed(currentEraStartTs);
  let firstEpochInEra = currentEraStartTs / SECONDS_IN_WEEK;
  const arr = await deriveAccountInfo(
    seed_word,
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  )

  const currentPointerAccount = arr[0];
  const currentPointerSeed = arr[2];
  const currentPointerInfo = await getAccountInfo(
    currentPointerAccount,
    connection, 
  );
  console.log("pointer account", currentPointerAccount.toString());

  //init some vars here so we can use them again outside the if statement.
  var currentCalAccount = "";
  var currentCalSeed = "";

  //find out if the current pointer is the window start or not.
  var currentEraIsWindowStart = false;
  if (currentPointerInfo == null && firstEpochInEra != ZERO_EPOCH) {
    //there isn't a pointer account initialized for the current timeframe. 
    //the current era is the window end. The previous era is the window start
    //do nothing, since we've set the flag the way we want
  } else if (firstEpochInEra == ZERO_EPOCH) {
    //we're initializing our voting system. This is the only case where there isn't a pointer
    //account, but we want the current era to be the window start.
    currentEraIsWindowStart = true;
  } else {
    //we'll need to look at the calendar account to decide if the current era is the window start

    //check the info of the calendar account
    const calArr = await deriveAccountInfo(
      getSeedWord(["calendar", currentPointerAccount]),
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    );
    currentCalAccount = calArr[0];
    currentCalSeed = calArr[2];
    const currentCalInfo = await getAccountInfo(
      currentCalAccount,
      connection, 
    );
    console.log("calendar account", currentCalAccount.toString());

    if (currentCalInfo == null) {
      //there isn't a calendar account initialized for the current timeframe.
      //the current era is the window end. the last era is the window start.
      //do nothing, since the flag is set the way we want.
    } else {
      //there is a calendar account initialized for the current timeframe. 
      //the current era is the window start. the next era is the window end. 
      //set the flag to the value we need it to be
      currentEraIsWindowStart = true;
    }
  }
  console.log("is the current era the window start?", currentEraIsWindowStart);

  //init some vars so we have access to them outside this if statement
  let windowStartEraTs = ""
  let windowEndEraTs = ""
  if (currentEraIsWindowStart) {
    windowStartEraTs = currentEraStartTs;
    windowEndEraTs = currentEraStartTs + (SECONDS_IN_WEEK * WEEKS_IN_ERA);
    //handle the zero era case where we're initializing everything. The end result is that
    //we will fill in the window from the zero epoch to the current epoch.
    //unless of course, we're over 6 months past the zero epoch, which will break everything.
    if (windowStartEraTs == (ZERO_EPOCH * SECONDS_IN_WEEK)) {
      windowEndEraTs = windowStartEraTs
    }
  } else {
    windowStartEraTs = currentEraStartTs - (SECONDS_IN_WEEK * WEEKS_IN_ERA);
    windowEndEraTs = currentEraStartTs;
  }
  
  //get the accounts and info that we'll need.
  console.log("deriving pointer accounts for window start");
  const [
    windowStartPointer,
    winStartPointerSeed,
    winStartPointerInfo,
  ] = await deriveWindowPointerAccountsAndData(windowStartEraTs, connection);

  console.log("deriving pointer accounts for window end");
  const [
    windowEndPointer,
    winEndPointerSeed,
    winEndPointerInfo,
  ] = await deriveWindowPointerAccountsAndData(windowEndEraTs, connection);
  
  return [
    windowStartEraTs,
    windowStartPointer,
    winStartPointerSeed,
    winStartPointerInfo,
    windowEndEraTs,
    windowEndPointer,
    winEndPointerSeed,
    winEndPointerInfo,
  ]
}

async function deriveWindowPointerAccountsAndData(
  eraStartTs: number,
  connection: Connection,
): Array<any> {
  const seedWord = getPointerSeed(eraStartTs);
  const arr = await deriveAccountInfo(
    seedWord,
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  )
  const pointerAccount = arr[0];
  const pointerSeed = arr[2];
  const pointerInfo = await getAccountInfo(
    pointerAccount,
    connection, 
  )
  return [
    pointerAccount,
    pointerSeed,
    pointerInfo
  ]
}

export function getExistingCalAccount(
  pointerInfo: Buffer,
): PublicKey {
  //cal account key starts at the 3rd byte of data and is 32 bytes long. 
  const calBytes = pointerInfo.data.slice(2,34);
  console.log("calbytes",calBytes)
  return new PublicKey(calBytes);
}

export async function getLastFiledEpoch(
  calAccount: PublicKey,
  connection: Connection,
): Promise<number> {
  const calInfo = await getAccountInfo(
    calAccount,
    connection, 
  )
  //last filed epoch is stored in the first two bytes of the calendar header
  const lastFiledEpochBytes = calInfo.data.slice(0,2);
  return Numberu16.fromBuffer(lastFiledEpochBytes).toNumber()
}

export async function getLastFiledPoint(
  calAccount: PublicKey, 
  connection: Connection,
  currentEraStartEpoch: number,
): Promise<Point> {
  let lastFiledEpoch = await getLastFiledEpoch(
    calAccount,
    connection
  );
  const calInfo = await getAccountInfo(
    calAccount,
    connection
  );
  //point data starts at the 4th byte in the calendar's data
  let allPointData = calInfo.data.slice(3);
  let diff = lastFiledEpoch - currentEraStartEpoch
  console.log("last filed epoch", lastFiledEpoch);
  console.log("current era start epoch", currentEraStartEpoch);
  console.log("diff",diff);
  let pointData = allPointData.slice(
    (diff * CAL_ENTRY_SIZE),
    ((diff + 1) * CAL_ENTRY_SIZE)
  )
  return Point.unpack(pointData)
}

export function calculateProtocolVotingPower(
  point: Point,
  currentTs: number
): number {
  //just for now! This is a lot more complex in reality.
  let pointTs = point.epoch * SECONDS_IN_WEEK;
  let votingPower = point.bias - point.slope * (currentTs - pointTs);
  return Math.floor(votingPower / 1000000000) //not in lamports to make it more human readable.
}

//given a timestamp in seconds, return the epoch that timestamp belongs in and the timestamp 
//of that epoch in seconds
export function getEpochFromTs(
  ts: number
): Array<number> {
  let epoch = Math.floor(ts / SECONDS_IN_WEEK)
  let epochTs = epoch * SECONDS_IN_WEEK
  return [epoch, epochTs]
}

export async function getNewCalAccountSize(
  connection,
  calAccount: PublicKey,
  startingEpoch: number,
  currentEpoch: number,
  lastEpochInEra: number,
): Promise<number> {
  const calInfo = await getAccountInfo(
    calAccount,
    connection,
  )
  //init calSize so we can use it later.
  let calSize = 0;
  if (calInfo == null) {
    //we're creating a net new calendar account. cal size should be initiated at 3 to account
    //for the header
    calSize = 3;
  } else {
    calSize = calInfo.data.length();
  }
  let checkEpoch = startingEpoch;
  let continueFlag = true;
  while (continueFlag) {
    calSize += CAL_ENTRY_SIZE;
    if (checkEpoch == currentEpoch || checkEpoch == lastEpochInEra) {
      continueFlag = false;
    }
    checkEpoch += 1;
  }
  return calSize
}


//takes an arbitrary unix timestamp and returns the first timestamp of the era the input timestamp
//belongs to 
export function getEraTs(
  ts:number
): number {
  //first, get the timestamp for the pointer account that will hold info for this point in time
  //starts at the protocol's zero epoch. iterates through the timestamps for the timeframes each pointer 
  //account represents until we find the timestamp where our parameter fits.
  //for our purposes, zero epoch of our protocol is 1/6/22 0000 GMT
  const zero_epoch_ts = SECONDS_IN_WEEK * ZERO_EPOCH;
  const seconds_in_era = SECONDS_IN_WEEK * WEEKS_IN_ERA
  var left_ts = zero_epoch_ts;
  var right_ts = zero_epoch_ts + seconds_in_era;
  var check = true
  while (check) {
    if (left_ts <= ts && ts < right_ts) {
      check = false
      break
    } else {
      left_ts += seconds_in_era;
      right_ts += seconds_in_era;
    }
  }
  return left_ts
}

export function getSeedWord(
  seeds: any
): Buffer {
  //combine the seeds into an array of buffers
  const seedBuffArray = seeds.map((s) => {
    if (typeof s == "string") {
      return Buffer.from(s);
    } else if ("toBytes" in s) {
      return s.toBytes();
    }
  });

  //combine the buffers in the array into a single buffer
  let allBuffs = Buffer.concat(seedBuffArray);

  return allBuffs
}

export const createAssociatedTokenAccount = async (
  systemProgramId: PublicKey,
  clockSysvarId: PublicKey,
  fundingAddress: PublicKey,
  walletAddress: PublicKey,
  splTokenMintAddress: PublicKey,
): Promise<TransactionInstruction> => {
  const associatedTokenAddress = await findAssociatedTokenAddress(
    walletAddress,
    splTokenMintAddress,
  );
  const keys = [
    {
      pubkey: fundingAddress,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: associatedTokenAddress,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: walletAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: splTokenMintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
};
