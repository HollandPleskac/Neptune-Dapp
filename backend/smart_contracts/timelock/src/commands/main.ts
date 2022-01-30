import {
  Account,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  Connection,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  populateVestingAccountIx,
  createVestingAccountInstruction,
  createUnlockInstruction,
  createNewDataAccountInstruction,
  populateNewDataAccountInstruction,
  onChainVotingPowerTestInstruction,
  newPointerIx,
  createCalendarIx,
} from './instructions';
import {
  findAssociatedTokenAddress,
  createAssociatedTokenAccount,
  getAccountInfo,
  deriveAccountInfo,
  getDataAccount,
  getVotingPower,
  transferInstructions,
  getPointerSeed,
  Numberu32
} from './utils';
import { ContractInfo, Schedule, unpackCalendar } from './state';
import { assert } from 'console';
import bs58 from 'bs58';
import { 
  SCHEDULE_SIZE,
  SECONDS_IN_WEEK,
  WEEKS_IN_EPOCH,
  ZERO_EPOCH,
  TOKEN_VESTING_PROGRAM_ID,
  NEPTUNE_MINT,
  CAL_ENTRY_SIZE
 } from './const';
 import{ serialize, deserialize } from 'borsh';

export async function createVestingAccount(
  programId: PublicKey,
  seedWordBump: Buffer | Uint8Array,
  payer: PublicKey,
  sourceTokenOwner: PublicKey,
  possibleSourceTokenPubkey: PublicKey | null,
  destinationTokenPubkey: PublicKey,
  mintAddress: PublicKey,
  schedules: Array<Schedule>,
  amountToLock:number,
  vestingAccountKey: PublicKey,
  vestingTokenAccountKey: PublicKey,
  dataAccountKey: PublicKey,
  dataAccountSeed: Buffer | Uint8Array,
  yearsToLock: number
): Promise<Array<TransactionInstruction>> {
  // If no source token account was given, use the associated source account
  if (possibleSourceTokenPubkey == null) {
    possibleSourceTokenPubkey = await findAssociatedTokenAddress(
      sourceTokenOwner,
      mintAddress,
    );
  }

  console.log(
    'Vesting contract account pubkey: ',
    vestingAccountKey.toBase58(),
  );

  console.log('vesting contract seed word bumo: ', bs58.encode(seedWordBump));

  console.log(
    'data account pubkey: ',
    dataAccountKey.toBase58(),
  );

  console.log('data contract seed word bumo: ', bs58.encode(dataAccountSeed));

  var instruction = [
    createVestingAccountInstruction(
      SystemProgram.programId,
      programId,
      payer,
      vestingAccountKey,
      [seedWordBump],
      dataAccountKey,
      [dataAccountSeed],
      schedules.length,
    ),
    await createAssociatedTokenAccount(
      SystemProgram.programId,
      SYSVAR_CLOCK_PUBKEY,
      payer,
      vestingAccountKey,
      mintAddress,
    ),
    
    populateVestingAccountIx(
      programId,
      TOKEN_PROGRAM_ID,
      vestingAccountKey,
      vestingTokenAccountKey,
      dataAccountKey,
      sourceTokenOwner,
      possibleSourceTokenPubkey,
      destinationTokenPubkey,
      mintAddress,
      schedules,
      [seedWordBump],
      [dataAccountSeed],
      yearsToLock
    ),
  ];
  return instruction;
};

export async function add(
  programId: PublicKey,
  vestingAccountSeed: Buffer | Uint8Array,
  sourceTokenOwner: PublicKey,
  possibleSourceTokenPubkey: PublicKey,
  mintAddress: PublicKey,
  schedules: Array<Schedule>,
  vestingAccountKey: PublicKey,
  vestingTokenAccountKey: PublicKey,
  oldDataAccountKey: PublicKey,
  newDataAccountKey: PublicKey,
  newDataAccountSeed: Buffer | Uint8Array,
  amountToLock: number,
  decimals: any,
): Promise<Array<TransactionInstruction>> {

    // If no source token account was given, use the associated source account
  if (possibleSourceTokenPubkey == null) {
    possibleSourceTokenPubkey = await findAssociatedTokenAddress(
      sourceTokenOwner,
      mintAddress,
    );
  }

  let instruction = [
    createNewDataAccountInstruction(
      programId,
      vestingAccountKey,
      sourceTokenOwner,
      SystemProgram.programId,
      schedules,
      [vestingAccountSeed],
      oldDataAccountKey,
      newDataAccountKey,
      [newDataAccountSeed],
    ),
    populateNewDataAccountInstruction(
      programId,
      vestingAccountKey,
      vestingTokenAccountKey,
      sourceTokenOwner,
      possibleSourceTokenPubkey,
      schedules,
      [vestingAccountSeed],
      oldDataAccountKey,
      newDataAccountKey,
      [newDataAccountSeed],
      amountToLock,
      decimals,
    )
  ]
  return instruction
};



export async function unlock(
  connection: Connection,
  vestingProgramId: PublicKey,
  userAccount: PublicKey,
  mintPk: PublicKey,
): Promise<Array<TransactionInstruction>> {

  //get the user's vesting account
  const arr = await deriveAccountInfo(
    userAccount.toBuffer(),
    vestingProgramId,
    mintPk
  )
  const vestingAccountKey = arr[0];
  const vestingTokenAccountKey = arr[1];
  const seedWordBump = arr[2];

  //get nuts and bolts from the data of the vesting account. We're dealing with a buffered 
  //version of a VestingScheduleHeader struct defined in programs/src/state.rs
  const vestingInfo = await getAccountInfo(vestingAccountKey, connection);
  if (vestingInfo == null) {
    throw new Error("the connected wallet has not initialized a vesting account");
  } else {
    const vestingData = vestingInfo.data
    const destinationTokenAddressRaw = vestingData.slice(0,32);
    const destinationTokenAddress = new PublicKey(destinationTokenAddressRaw);
    const dataAccountKey = getDataAccount(vestingData);;

    //create the instruction
    let instruction = [
      createUnlockInstruction(
        vestingProgramId,
        TOKEN_PROGRAM_ID,
        SYSVAR_CLOCK_PUBKEY,
        vestingAccountKey,
        vestingTokenAccountKey,
        destinationTokenAddress,
        dataAccountKey,
        [seedWordBump],
      ),
    ];
  
    return instruction;
  }
}

export async function getContractInfo(
  connection: Connection,
  vestingAccountKey: PublicKey,
): Promise<ContractInfo> {
  console.log('Fetching contract ', vestingAccountKey.toBase58());
  const vestingInfo = await connection.getAccountInfo(
    vestingAccountKey,
    'single',
  );
  if (!vestingInfo) {
    throw 'Vesting contract account is unavailable';
  }
  const info = ContractInfo.fromBuffer(vestingInfo!.data);
  if (!info) {
    throw 'Vesting contract account is not initialized';
  }
  return info!;
}

export async function  onChainVotingPower(
  connection: Connection,
  userPk: PublicKey,
  vestingAccount: PublicKey,
  vestingAccountSeed: Buffer | Uint8Array,
): Promise<Array<TransactionInstruction>> {
  var instruction: Array<TransactionInstruction> = [];
  //get voting power on client to compare it to the on chain value
  const vestingAccountInfo = await getAccountInfo(
    vestingAccount,
    connection
  );
  if (vestingAccountInfo == null) {
    console.log("error - a vesting account has not been initialized");
  } else {
    const dataAccountKey = getDataAccount(vestingAccountInfo.data);
    const dataAccountInfo = await getAccountInfo( 
      dataAccountKey,
      connection
    );
    if (dataAccountInfo == null) {
      console.log("error- a data account does not exist")
    } else {
      const dataAccountData = dataAccountInfo.data;
      const rawSchedules = dataAccountData.slice(33);
      const numOfSchedules = rawSchedules.length / SCHEDULE_SIZE;
      const votingPower = getVotingPower(rawSchedules, numOfSchedules);
  
      //get instruction
      var instruction = [
        onChainVotingPowerTestInstruction(
          userPk,
          vestingAccount,
          dataAccountKey,
          [vestingAccountSeed],
          votingPower
        ),
      ];
    }
  } 
  return instruction
}

export async function buildPointerAndCalendarIx(
  todaysDateInSeconds: number,
  unlockDateInSeconds: number,
  userPk: PublicKey,
  connection: Connection
): Promise<Array<TransactionInstruction>> {
    var ix: Array<TransactionInstruction> = [];

    //POINTER ACCOUNT HANDLING
    //epochs are the number of weeks since unix zero time. Each pointer account stores
    //a calendar account that holds 26 weeks (6 months) worth of data.
    //each pointer account is derived from the unix timestamp of the first epoch it records
    //data for
    const current_epoch = Math.floor(todaysDateInSeconds / SECONDS_IN_WEEK);
    const current_epoch_ts = SECONDS_IN_WEEK * current_epoch;
    const unlock_epoch = Math.floor(unlockDateInSeconds / SECONDS_IN_WEEK);
    const unlock_epoch_ts = SECONDS_IN_WEEK * unlock_epoch;
  
    const current_pointer_ix = buildPointerIx(current_epoch_ts, userPk, connection);
    const unlock_pointer_ix = buildPointerIx(unlock_epoch_ts, userPk, connection);

    //see if a pointer account exists for each pointer ts.
    //if it doesn't, create one and create a calendar account for it
    //if it does exist, get the calendar account and see if there's a point for the timestamp
    return ix
}

export async function buildPointerIx(
  ts: number,
  userPk: PublicKey,
  connection: Connection
  ): Promise<Array<TransactionInstruction>> {
    var ix: Array<TransactionInstruction> = [];
  
    //starts at the zero epoch. iterates through the timestamps for the timeframes each pointer 
    //account represents until we find the timestamp where our parameter fits.
    //for our purposes, zero epoch of our protocol is 1/6/22 0000 GMT
    const zero_epoch_ts = SECONDS_IN_WEEK * ZERO_EPOCH;
    const seconds_in_epoch = SECONDS_IN_WEEK * WEEKS_IN_EPOCH
    var left_ts = zero_epoch_ts;
    var right_ts = zero_epoch_ts + seconds_in_epoch;
    var check = true
    while (check) {
      if (left_ts <= ts && ts <= right_ts) {
        check = false
        break
      } else {
        left_ts += seconds_in_epoch
        right_ts += seconds_in_epoch
      }
    }

    //check to see if there is a pointer account for the given timestamp.
    const seed_word = getPointerSeed(left_ts);
    const arr = await deriveAccountInfo(
      seed_word,
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    )
    const pointer_account = arr[0];
    const pointer_seed = arr[2];
    const pointer_info = getAccountInfo(
      pointer_account,
      connection, 
    )

    //get the calendar info here too, since we'l need it either way
    const cal_arr = await deriveAccountInfo(
      pointer_account.toBuffer(),
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    );
    const cal_account = cal_arr[0];
    const cal_seed = cal_arr[2];

    if (pointer_info == null) {
    //if pointer account info is empty, build ix to create a new pointer account and a new
    //calendar account to go in it. The create calendar ix needs to come first. 
    //cal size is 5 bytes for header, 4 bytes for btree init and CAL_ENTRY_SIZE bytes for the first cal entry.
      const cal_size = 5 + 4 + CAL_ENTRY_SIZE;
      const create_calendar_ix = createCalendarIx(
        userPk,
        cal_account, 
        [cal_seed],
        cal_size
      );
      ix = transferInstructions(create_calendar_ix, ix);
      const create_pointer_ix = await newPointerIx(
        userPk,
        pointer_account,
        [pointer_seed],
        cal_account
      );
      ix = transferInstructions(create_pointer_ix, ix);

    } else {
    //if pointer account info is NOT empty, get info about the calendar account within it. Then
    //de-serialize the calendar within and check to see if there is a point for the timestamp
    //we're looking for. If there is, then we'll just update that account. If there isn't, 
    //create ix for a net new calendar account and save it to the pointer
      const cal_info = getAccountInfo(
        cal_account,
        connection, 
      )
      if (cal_info == null) {
        console.log("pointer account present without calendar inside it. This should never happen");
      } else {
        const cal_data = cal_info.data;
        const num_of_cal_entries = new Numberu32(cal_data.slice(1,6));
        const raw_calendar = cal_data.slice(6);
        const calendar = unpackCalendar(raw_calendar.toBuffer());
        console.log("calendar!", calendar)


      }
    }

  
    return ix
  }
