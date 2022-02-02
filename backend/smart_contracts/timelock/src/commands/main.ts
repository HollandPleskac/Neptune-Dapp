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
  populateNewCalendarIx
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
  getEraTs,
  getWindowPointerAccountsAndData,
  getExistingCalAccount,
  getLastFiledEpoch,
  getNewCalAccountSize
} from './utils';
import { ContractInfo, Schedule, Point, VestingScheduleHeader } from './state';
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
import cssVars from '@mui/system/cssVars';

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
  yearsToLock: number,
  windowStartPointer: PublicKey,
  windowStartCal: PublicKey,
  windowStartDslope: PublicKey,
  windowEndPointer: PublicKey,
  windowEndCal: PublicKey,
  windowEndDslope: PublicKey,
  newUnlockPointer: PublicKey,
  newUnlockDslope: PublicKey,
  oldUnlockPointer: PublicKey,
  oldUnlockDslope: PublicKey,
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
      windowStartPointer,
      windowStartCal,
      windowStartDslope,
      windowEndPointer,
      windowEndCal,
      windowEndDslope,
      newUnlockPointer,
      newUnlockDslope,
      oldUnlockPointer,
      oldUnlockDslope,
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
  windowStartPointer: PublicKey,
  windowStartCal: PublicKey,
  windowStartDslope: PublicKey,
  windowEndPointer: PublicKey,
  windowEndCal: PublicKey,
  windowEndDslope: PublicKey,
  newUnlockPointer: PublicKey,
  newUnlockDslope: PublicKey,
  oldUnlockPointer: PublicKey,
  oldUnlockDslope: PublicKey,
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
      windowStartPointer,
      windowStartCal,
      windowStartDslope,
      windowEndPointer,
      windowEndCal,
      windowEndDslope,
      newUnlockPointer,
      newUnlockDslope,
      oldUnlockPointer,
      oldUnlockDslope,
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
  userPk: PublicKey,
  connection: Connection,
  oldSchedule: Schedule,
  newSchedule: Schedule,
): Promise<Array<any>> {
    var ix: Array<TransactionInstruction> = [];

    //POINTER ACCOUNT HANDLING
    //epochs are the number of weeks since unix zero time. Each pointer account stores
    //a calendar account that holds 26 weeks (6 months) worth of data.
    //each pointer account is derived from the unix timestamp of the first epoch it records
    //data for.

    const newUnlockDateInSeconds = newSchedule.releaseTime.toNumber();
    const currentEpoch = Math.floor(todaysDateInSeconds / SECONDS_IN_WEEK);
    const currentEpochTs = SECONDS_IN_WEEK * currentEpoch;
    const newUnlockEpoch = Math.floor(newUnlockDateInSeconds / SECONDS_IN_WEEK);
    const newUnlockEpochTs = SECONDS_IN_WEEK * newUnlockEpoch;

    //an era is the amount of time represented by one pointer account (6 months).  Pointer accounts
    //are created based on the first timestamp that belongs to the era. We calculate the current 
    //era and unlocking era here to handle the case where a user is locking and unlocking
    //tokens in the same era. In that case, only one pointer account will be needed. 
    const currentEraStartTs = getEraTs(currentEpochTs)
    const newUnlockEraStart = getEraTs(newUnlockEpochTs)

    //needs for next steps
    //get the window start and window end accounts, the seeds to create them (if needed) and the
    //data stored in each account.
    const [
      windowStartEraTs,
      windowStartPointer,
      winStartPointerSeed,
      winStartPointerInfo,
      windowEndEraTs,
      windowEndPointer,
      winEndPointerSeed,
      winEndPointerInfo,
    ] = await getWindowPointerAccountsAndData(
      currentEpoch,
      currentEpochTs,
      currentEraStartTs
    );
    //write a function to determine the instructions needed for each of the window accounts
      //hardest part of this one will be finding out how much space will be needed for each of the
      //window start and window end calendar accounts, and if we'll need new accounts at all.

    const [
      pointerAndCalIx,
      windowStartCal,
      winStartCalSeed,
      windowStartDslope,
      winStartDslopeSeed,
      windowEndCal,
      winEndCalSeed,
      windowEndDslope,
      windowEndDslopeSeed,
    ] = await buildAllPointerIx(
      connection,
      userPk,
      currentEpoch,
      windowStartEraTs,
      windowStartPointer,
      winStartPointerSeed,
      winStartPointerInfo,
      windowEndEraTs,
      windowEndPointer,
      winEndPointerSeed,
      winEndPointerInfo,
    );
    ix = transferInstructions(pointerAndCalIx, ix);

    //write a function to get the pointer and dslope accounts for the new and old schedules.
      //note that this will need to handle the case where a user is locking and unlocking tokens within the same era.
      //we'll also need to handle the case where the user is creating a net new unlock position,
      //which will require a dslope account creation instruction
      const [
      unlockDslopeIx,
      newUnlockPointer,
      newUnlockDslope,
      oldUnlockPointer,
      oldUnlockDslope
    ] = await buildAllUnlockDslopeIx(
      userPk,
      connection,
      newSchedule,
      oldSchedule,
      windowStartPointer,
      windowEndPointer,
    );
    ix = transferInstructions(unlockDslopeIx, ix);
    
    //we've got everything we need!
    return [
      ix,
      windowStartPointer,
      windowStartCal,
      windowStartDslope,
      windowEndPointer,
      windowEndCal,
      windowEndDslope,
      newUnlockPointer,
      newUnlockDslope,
      oldUnlockPointer,
      oldUnlockDslope,
    ]
}

export async function buildAllPointerIx(
  connection: Connection,
  userPk: PublicKey,
  currentEpoch: number,
  windowStartEraTs: number, //first timestamp in era for our window start
  windowStartPointer: PublicKey,
  winStartPointerSeed: Buffer,
  winStartPointerInfo: Buffer | null,
  windowEndEraTs: number,
  windowEndPointer: PublicKey,
  winEndPointerSeed: Buffer,
  winEndPointerInfo: Buffer | null,
): Promise<Array<any>> {
  let allPointerIx: Array<any> = [];

  //we can make a new function to do whatever we want.
  //when we work with the calendar, just expand it until we either
    //hit the last epoch in the calendar's era
    //hit the current epoch.
  const [
    windowStartIx,
    windowStartCal,
    winStartCalSeed,
    windowStartDslope,
    winStartDslopeSeed,
  ] = await buildOnePointerIx(
    connection,
    userPk,
    currentEpoch,
    windowStartEraTs,
    windowStartPointer,
    winStartPointerSeed,
    winStartPointerInfo,
  );
  allPointerIx = transferInstructions(windowStartIx, allPointerIx);

  //init some vars so we have access to them outside the if statment.
  var windowEndCal:any = "";
  var winEndCalSeed: any = "";
  var windowEndDslope:any = "";
  var winEndDslopeSeed: any = "";
  var windowEndIx: any = "";


  //handle the zero epoch / creation case.
  if (windowStartEraTs != windowEndEraTs) {
    [
      windowEndIx,
      windowEndCal,
      winEndCalSeed,
      windowEndDslope,
      winEndDslopeSeed,
    ] = await buildOnePointerIx(
      connection,
      userPk,
      currentEpoch,
      windowEndEraTs,
      windowEndPointer,
      winEndPointerSeed,
      winEndPointerInfo,
    );
    allPointerIx = transferInstructions(windowEndIx, allPointerIx);
  } else {
    //the only time that the window start and window end should have equal timestamps is when
    //the first time anyone stakes anything in our protocol. 
    console.log("staking protocol created");
  }

  return [
    allPointerIx,
    windowStartCal,
    winStartCalSeed,
    windowStartDslope,
    winStartDslopeSeed,
    windowEndCal,
    winEndCalSeed,
    windowEndDslope,
    winEndDslopeSeed,
  ]
}

export async function buildOnePointerIx(
  connection: Connection,
  userPk: PublicKey,
  currentEpoch: number,
  windowEraStartTs: number,
  pointerAccount: PublicKey,
  pointerSeed: Buffer,
  pointerInfo: Buffer | null,
): Promise<Array<any>> {

  let ix: Array<TransactionInstruction> = [];
  let lastEpochInEra = (windowEraStartTs / SECONDS_IN_WEEK) + WEEKS_IN_ERA - 1;
  let calAccount = "";
  let calSeed = "";

  //derive the dslope info first, since that's going to be the same no matter what we need
  //to do for the calendar account. 
  const dslopeArr = await deriveAccountInfo(
    getSeedWord([pointerAccount, "dslope"]),
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  );
  const dslopeAccount = dslopeArr[0];
  const dslopeSeed = dslopeArr[2];

  if (pointerInfo == null) {
    //if pointer account info is empty, build ix to create a new pointer account, a new
    //calendar account and a new dslope account to go in it. 

    //derive keys for the first cal account of an era and the era's dslope account
    const calArr = await deriveAccountInfo(
      getSeedWord([pointerAccount, "calendar"]),
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    );
    const calAccount = calArr[0];
    const calSeed = calArr[2];

    //get the size of the new calendar account. 
    const calAccountSize = await getNewCalAccountSize(
      connection,
      calAccount,
      ZERO_EPOCH,
      currentEpoch,
      lastEpochInEra
    );
    const createCalIx = createCalendarIx(
      userPk,
      calAccount, 
      [calSeed],
      calAccountSize,
    );
    ix = transferInstructions(createCalIx, ix);

    const dslopeIx = createDslopeIx(
      userPk,
      dslopeAccount,
      [dslopeSeed]
    );
    ix = transferInstructions(dslopeIx, ix);
    const create_pointer_ix = await newPointerIx(
      userPk,
      pointerAccount,
      [pointerSeed],
      calAccount,
      dslopeAccount
    );
    ix = transferInstructions(create_pointer_ix, ix);

  } else {
    //pointer account info exists. That means that we already have a dslope account.
    //so we only need to find out if we're going to init a new calendar account, or if we
    //can keep the old one. That should be easy though. Just check the last filed epoch. 
    const existingCalAccount = getExistingCalAccount(pointerInfo);
    const lastFiledEpoch = await getLastFiledEpoch(existingCalAccount, connection);
    if (lastFiledEpoch != currentEpoch) {
      //create a net new calendar account. Need to find out how large it needs to be though. 
      const newCalAccountSize = await getNewCalAccountSize(
        connection,
        existingCalAccount,
        lastFiledEpoch,
        currentEpoch,
        lastEpochInEra
      );
      const calArr = await deriveAccountInfo(
        existingCalAccount.toBuffer(),
        TOKEN_VESTING_PROGRAM_ID,
        NEPTUNE_MINT
      );
      const newCalAccount = calArr[0];
      const newCalSeed = calArr[2];
      const createCalIx = createCalendarIx(
        userPk,
        newCalAccount, 
        [newCalSeed],
        newCalAccountSize,
      );
      ix = transferInstructions(createCalIx, ix);

      //create instructions for transferring the old cal data to the new cal data account.
      const populateNewCalAccountIx = populateNewCalendarIx(
        userPk,
        pointerAccount,
        newCalAccount,
        [newCalSeed],
        existingCalAccount,
      );
      ix = transferInstructions(populateNewCalAccountIx, ix);
      calAccount = newCalAccount;
      calSeed = newCalSeed;
      
    } else {
      //nothing needs to happen because the point object we'll be changing already exists.
    }
  }
  return [
    ix,
    calAccount,
    calSeed,
    dslopeAccount,
    dslopeSeed,
  ]
}

async function buildAllUnlockDslopeIx(
  userPk: PublicKey,
  connection: Connection,
  newSchedule: Schedule,
  oldSchedule: Schedule,
  windowStartPointer:PublicKey,
  windowEndPointer: PublicKey,
): Promise<Array<any>> {
  let allIx: Array<any> = [];
  const [
    newUnlockIx,
    newUnlockPointer,
    newUnlockDslope
  ] = await buildUnlockDslopeIx(
    userPk,
    connection, 
    newSchedule, 
    windowStartPointer, 
    windowEndPointer
  );
  allIx = transferInstructions(newUnlockIx, allIx);

  const [
    oldUnlockIx,
    oldUnlockPointer,
    oldUnlockDslope
  ] = await buildUnlockDslopeIx(
    userPk, 
    connection, 
    oldSchedule, 
    windowStartPointer, 
    windowEndPointer
  );
  allIx = transferInstructions(oldUnlockIx, allIx);
  return [
    allIx,
    newUnlockPointer,
    newUnlockDslope,
    oldUnlockPointer,
    oldUnlockDslope,
  ]
}

async function buildUnlockDslopeIx(
  userPk: PublicKey,
  connection: Connection,
  schedule: Schedule,
  windowStartPointer:PublicKey,
  windowEndPointer: PublicKey,
): Promise<Array<any>> {
  //init some vars so we'll always have them
  let ix: Array<any> = [];
  let pointerAccount: any = "";
  let dslopeAccount:any = "";

  //get the pointer account associated with the schedule's unlock time.
  let unlockTs = schedule.releaseTime.toNumber();
  let firstTsInUnlockEra = getEraTs(unlockTs);
  let firstEpochInUnlockEra = firstTsInUnlockEra / SECONDS_IN_WEEK;
  const seedWord = getPointerSeed(firstEpochInUnlockEra);
  const arr = await deriveAccountInfo(
    seedWord,
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  )
  pointerAccount = new PublicKey(arr[0]);
  const pointerSeed = arr[2];

  //get the dslope account associated with the pointer
  const dslopeArr = await deriveAccountInfo(
    getSeedWord([pointerAccount, "dslope"]),
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  );
  dslopeAccount = new PublicKey(dslopeArr[0]);
  const dslopeSeed = dslopeArr[2];
  
  //make sure the pointer account we've derived isn't one of the ones we'll be creating
  //in an earlier instruction; 
  if (pointerAccount == windowStartPointer || pointerAccount == windowEndPointer) {
    //we don't need to actually do anything here. For this case, we just need the dslope
    //account key, which we already have above.
  } else {
    //This isn't apointer account we'll be interacting with in this transaction.
    //check the pointer account's data to see if its been created already. 
    const pointerInfo = await getAccountInfo(
      pointerAccount,
      connection, 
    )
    if (pointerInfo == null) {
      //there is no pointer account, and it isn't one we'll be creating in this transaction.
      //issue new instructions to create the new pointer account and dlsope account. 
      const dslopeIx = createDslopeIx(
        userPk,
        dslopeAccount,
        [dslopeSeed]
      );
      ix = transferInstructions(dslopeIx, ix);
      const create_pointer_ix = await newPointerIx(
        userPk,
        pointerAccount,
        [pointerSeed],
        TOKEN_VESTING_PROGRAM_ID, //we need a pubkey here for the cal account, so we'll just put in the program ID
        dslopeAccount
      );
      ix = transferInstructions(create_pointer_ix, ix);
    } else {
      //we don't need to do anything here. We've got a pointer account that exists, and isn't 
      //one of the ones that's in play already. So just take its dslope account and we'll be on our way. 
    }
  }

  return [
    ix,
    pointerAccount,
    dslopeAccount
  ]
}

