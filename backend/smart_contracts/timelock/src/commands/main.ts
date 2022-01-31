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
  createDslopeIx,
  newCalendarIx
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
  Numberu32,
  getSeedWord,
  getEra
} from './utils';
import { ContractInfo, Schedule, Point } from './state';
import { assert } from 'console';
import bs58 from 'bs58';
import { 
  SCHEDULE_SIZE,
  SECONDS_IN_WEEK,
  WEEKS_IN_ERA,
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
): Promise<Array<any>> {
    var ix: Array<TransactionInstruction> = [];

    //POINTER ACCOUNT HANDLING
    //epochs are the number of weeks since unix zero time. Each pointer account stores
    //a calendar account that holds 26 weeks (6 months) worth of data.
    //each pointer account is derived from the unix timestamp of the first epoch it records
    //data for.
    const current_epoch = Math.floor(todaysDateInSeconds / SECONDS_IN_WEEK);
    const current_epoch_ts = SECONDS_IN_WEEK * current_epoch;
    const unlock_epoch = Math.floor(unlockDateInSeconds / SECONDS_IN_WEEK);
    const unlock_epoch_ts = SECONDS_IN_WEEK * unlock_epoch;

    //an era is the amount of time represented by one pointer account (6 months).  Pointer accounts
    //are created based on the first timestamp that belongs to the era. We calculate the current 
    //era and unlocking era here to handle the case where a user is locking and unlocking
    //tokens in the same era. In that case, only one pointer account will be needed. 
    const current_era_start = getEra(current_epoch_ts)
    const unlock_era_start = getEra(unlock_epoch_ts)
  
    //There's probably a better way to handle this... do we REALLY need to create
    //a calendar account for when the user will unlock their tokens? Also need to be 
    //careful of the case where they lock them up for a short period of time. In that
    //case, we could run into a case where we have multiple creation instructions for 
    //the same account... no bueno. actually, no, that can never happen, since a user can't 
    //lock and unlock tokens in the same epoch... no wait, that CAN happen because a user could
    //lock and unlock tokens within the same era that's represented by the pointer account... ugh, 
    //need to think about a way to gracefully handle that. 
    let [current_pointer_ix, current_pointer_account] = await buildPointerIx(
      current_epoch_ts, 
      userPk, 
      connection,
      current_era_start,
      "current");
    ix = transferInstructions(current_pointer_ix, ix);
    
    //if a user is locking and unlocking tokens in the same era, then we don't need multiple
    //pointer accounts. 
    if (current_era_start == unlock_era_start) {
      const unlock_pointer_account = current_pointer_account
      return [ix, current_pointer_account, unlock_pointer_account]
    } else {
      const [unlock_pointer_ix, unlock_pointer_account] = await buildPointerIx(
        unlock_epoch_ts, 
        userPk, 
        connection, 
        unlock_era_start,
        "unlock");
      ix = transferInstructions(unlock_pointer_ix, ix);
      return [ix, current_pointer_account, unlock_pointer_account]
    }
}

export async function buildPointerIx(
  epoch_ts: number,
  userPk: PublicKey,
  connection: Connection,
  era_start_ts: number,
  flag: string,
  ): Promise<Array<any>> {
    var ix: Array<TransactionInstruction> = [];

    //check to see if there is a pointer account for the given era start timestamp.
    const seed_word = getPointerSeed(era_start_ts);
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

    //get the calendar and dslope info here too, since we'll need it later
    const cal_arr = await deriveAccountInfo(
      getSeedWord([pointer_account, "calendar"]),
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    );
    const cal_account = cal_arr[0];
    const cal_seed = cal_arr[2];

    const dslope_arr = await deriveAccountInfo(
      getSeedWord([pointer_account, "dslope"]),
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    );
    const dslope_account = dslope_arr[0];
    const dslope_seed = dslope_arr[2];

    if (pointer_info == null) {
    //if pointer account info is empty, build ix to create a new pointer account, a new
    //calendar account and a new dslope account to go in it. The create calendar  and dslope
    //ixs need to come first. 
      const create_calendar_ix = createCalendarIx(
        userPk,
        cal_account, 
        [cal_seed],
      );
      ix = transferInstructions(create_calendar_ix, ix);
      const create_dslope_ix = createDslopeIx(
        userPk,
        dslope_account,
        [dslope_seed]
      );
      ix = transferInstructions(create_dslope_ix, ix);
      const create_pointer_ix = await newPointerIx(
        userPk,
        pointer_account,
        [pointer_seed],
        cal_account,
        dslope_account
      );
      ix = transferInstructions(create_pointer_ix, ix);
    } else if (flag == "current") {
    //if pointer account info is NOT empty and we're looking at the current ts, get info 
    //about the calendar account within the pointer. then de-serialize the calendar within 
    //and check to see if there is a point for the timestamp we're looking for. Also check to
    //see if the cal account is going to need updated pointer objects. 
    //If the cal account needs more space, then create a new account of the proper size (net new tx + ix)
    //and save it to the pointer. if the cal account doesn't need more space, then we don't need to do
    //anything
    //note that we don't need to check the dslope account for the current OR unlock timestamp because that is
    //created with all the data that we'll ever need. 
      const cal_info = getAccountInfo(
        cal_account,
        connection, 
      )
      if (cal_info == null) {
        console.log("pointer account present without calendar inside it. This should never happen");
      } else {
        const raw_calendar = cal_info.data;
        const num_of_cal_entries = raw_calendar.length() / CAL_ENTRY_SIZE;

        //get the last point object saved to the calendar. 
        const last_point_bytes = raw_calendar.slice((num_of_cal_entries - 1) * CAL_ENTRY_SIZE)
        const last_point = Point.unpack(last_point_bytes)
        const last_point_epoch = last_point.epoch
        const this_epoch = epoch_ts / SECONDS_IN_WEEK;
        if (this_epoch != last_point_epoch) {
          //we'll need to change the calendar account in some way. Determine how drastically
          //we'll need to change it. 
          
          //diff always needs to be positive. Otherwise, a user could lock tokens in the past.
          const diff = this_epoch - last_point_epoch
          console.log(`need to add ${diff} calendar entries to the calendar account`)
          if (diff < 0) {
            console.log("current epoch is behind the last recorded epoch on the calendar. This should never happen")
          } else {
            //we'll need to add this muany bytes to the new calendar account
            const bytes_to_add = CAL_ENTRY_SIZE * diff

            //get the old calendar account from the Pointer account's data. use it to create the 
            //new calendar account key. 
            const pointer_data = pointer_info.data;
            const old_cal_account = new PublicKey(pointer_data.slice(0,32));
            const new_cal_arr = await deriveAccountInfo(
              getSeedWord([old_cal_account, "calendar"]),
              TOKEN_VESTING_PROGRAM_ID,
              NEPTUNE_MINT
            );
            const new_cal_account = new_cal_arr[0];
            const new_cal_seed = new_cal_arr[2];
            const create_new_cal_ix = newCalenderIx(
              userPk,
              pointer_account,
              new_cal_account,
              [new_cal_seed],
              old_cal_account,
              bytes_to_add
            )
            ix = transferInstructions(create_new_cal_ix, ix);
          }
        }
        //if this_epoch = last_point_epoch, then we're all good! We don't need to do anything
        //else to ready the calendar account. 
      }
    }

  
    return [ix, pointer_account]
  }
