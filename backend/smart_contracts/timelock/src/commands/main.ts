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
  userOnChainVotingPowerIx,
  protocolOnChainVotingPowerIx,
  newPointerIx,
  newCalendarIx,
  createDslopeIx,
  transferCalendarDataIx
} from './instructions';
import {
  findAssociatedTokenAddress,
  createAssociatedTokenAccount,
  deriveAccountInfo,
  getDataAccount,
  getUserVotingPower,
  transferInstructions,
  getPointerSeed,
  Numberu32,
  getSeedWord,
  getEraTs,
  getWindowPointerAccountsAndData,
  getExistingCalAccount,
  getLastFiledEpoch,
  getNewCalAccountSize,
  getAccountInfo,
  getEpochFromTs,
  calculateProtocolVotingPower,
  getLastFiledPoint,
  getEmptySchedule,
} from './utils';
import { ContractInfo, Schedule, Point, VestingScheduleHeader } from './state';
import { assert } from 'console';
import bs58 from 'bs58';
import { 
  SCHEDULE_SIZE,
  SECONDS_IN_EPOCH,
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

export async function  userOnChainVotingPower(
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
      const votingPower = getUserVotingPower(rawSchedules, numOfSchedules);
  
      //get instruction
      var instruction = [
        userOnChainVotingPowerIx(
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

export async function  protocolOnChainVotingPower(
  connection: Connection,
  userPk: PublicKey,
  currentEraStartEpoch: number,
  currentEpoch: number,
  currentEpochTs: number,
): Promise<Array<TransactionInstruction>> {
  let allIx: Array<TransactionInstruction> = [];

  //get nuts and bolts of what we'll need. This should also be enough to create new 
  //calendar accounts if we'll need the space to.
  const [
    windowIx,
    windowStartPointer,
    windowStartCal,
    windowStartDslope,
    windowEndPointer,
    windowEndCal,
    windowEndDslope,
  ] = await buildAllWindowIx(
    userPk,
    connection,
    currentEpoch,
    currentEpochTs,
  );
  console.log("window instructions", windowIx)
  allIx = transferInstructions(windowIx, allIx);

  //build instructions to call on chain function that can do the same calculation once the 
  //protocol has been updated.
  let vpIx = [
    protocolOnChainVotingPowerIx(
      userPk,
      windowStartPointer,
      windowStartCal,
      windowStartDslope,
      windowEndPointer,
      windowEndCal,
      windowEndDslope,
    )
  ];

  console.log("vp ix", vpIx);
  allIx = transferInstructions(vpIx, allIx);
  console.log("all Ix", allIx);

  console.log( {
    vestingProgram: TOKEN_VESTING_PROGRAM_ID.toString(),
    userPk:userPk.toString(),
    windowStartPointer: windowStartPointer.toString(),
    windowStartCal: windowStartCal.toString(),
    windowStartDslope: windowStartDslope.toString(),
    windowEndPointer: windowEndPointer.toString(),
    windowEndCal: windowEndCal.toString(),
    windowEndDslope: windowEndDslope.toString(),
  });

  return allIx
}

export async function buildAllWindowIx(
  userPk: PublicKey,
  connection: Connection,
  currentEpoch: number,
  currentEpochTs: number
): Promise<Array<any>> {
    var ix: Array<TransactionInstruction> = [];

    //POINTER ACCOUNT HANDLING
    //epochs are the number of weeks since unix zero time. Each pointer account stores
    //a calendar account that holds 26 weeks (6 months) worth of data.
    //each pointer account is derived from the unix timestamp of the first epoch it records
    //data for.

    console.log("current epoch", currentEpoch);
    console.log ("currentEpochTs", currentEpochTs);

    //an era is the amount of time represented by one pointer account (6 months).  Pointer accounts
    //are created based on the first timestamp that belongs to the era. We calculate the current 
    //era and unlocking era here to handle the case where a user is locking and unlocking
    //tokens in the same era. In that case, only one pointer account will be needed. 
    const currentEraStartTs = getEraTs(currentEpochTs)

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
      currentEraStartTs,
      connection,
    );
    //write a function to determine the instructions needed for each of the window accounts
      //hardest part of this one will be finding out how much space will be needed for each of the
      //window start and window end calendar accounts, and if we'll need new accounts at all.

    console.log('curent epoch', currentEpoch);

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
    
    //we've got everything we need!
    return [
      ix,
      windowStartPointer,
      windowStartCal,
      windowStartDslope,
      windowEndPointer,
      windowEndCal,
      windowEndDslope,
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
  console.log("building window start ix");
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
  //we'll still need SOMETHING for the window end cal and window end dslope though...
  //should they just be the same as the window start ones?
  if (windowStartEraTs != windowEndEraTs) {
    console.log("building window end ix");
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
    console.log("staking protocol in its first epoch");
    windowEndCal = windowStartCal;
    windowEndDslope = windowStartDslope;
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
  let [firstEpochInEra, placeholder] = getEpochFromTs(windowEraStartTs);
  let lastEpochInEra = firstEpochInEra + WEEKS_IN_ERA - 1;
  console.log('window era start ts', windowEraStartTs);
  console.log('firstEpochInEra', firstEpochInEra);
  console.log('lastEpochInEra', lastEpochInEra);
  console.log('current epoch', currentEpoch);
  let calAccount = userPk //placeholder
  let calSeed = "";

  //derive the dslope info first, since that's going to be the same no matter what we need
  //to do for the calendar account. 
  const dslopeArr = await deriveAccountInfo(
    getSeedWord(["dslope",pointerAccount]),
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  );
  const dslopeAccount = dslopeArr[0];
  const dslopeSeed = dslopeArr[2];
  console.log("pointer account", pointerAccount.toString());
  console.log("dslope account", dslopeAccount.toString());
  if (pointerInfo == null) {
    console.log("pointer info is null");
    //if pointer account info is empty, build ix to create a new pointer account, a new
    //calendar account and a new dslope account to go in it. 

    //derive keys for the first cal account of an era and the era's dslope account
    const calArr = await deriveAccountInfo(
      getSeedWord(["calendar",pointerAccount]),
      TOKEN_VESTING_PROGRAM_ID,
      NEPTUNE_MINT
    );
    calAccount = calArr[0];
    const calSeed = calArr[2];
    console.log("calendar account", calAccount.toString());

    //get the size of the new calendar account. 
    const calAccountSize = await getNewCalAccountSize(
      connection,
      calAccount,
      firstEpochInEra,
      currentEpoch,
      lastEpochInEra
    );
    console.log('cal account size is ', calAccountSize);
    const createCalIx = newCalendarIx(
      userPk,
      calAccount, 
      [calSeed],
      calAccountSize,
      firstEpochInEra,
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
      dslopeAccount,
      firstEpochInEra
    );
    ix = transferInstructions(create_pointer_ix, ix);

  } else {
    console.log("pointer info exists");
    //pointer account info exists. That means that we already have a dslope account.
    //so we only need to find out if we're going to init a new calendar account, or if we
    //can keep the old one. That should be easy though. Just check the last filed epoch. 
    const existingCalAccount = getExistingCalAccount(pointerInfo);
    console.log("existing cal account", existingCalAccount.toString());
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
      console.log("new cal account", newCalAccount.toString());
      const newCalSeed = calArr[2];
      const createCalIx = newCalendarIx(
        userPk,
        newCalAccount, 
        [newCalSeed],
        newCalAccountSize,
        firstEpochInEra
      );
      ix = transferInstructions(createCalIx, ix);

      //create instructions for transferring the old cal data to the new cal data account.
      const populateNewCalAccountIx = transferCalendarDataIx(
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
      //we don't need a new calendar account: we'll be okay to use the old one.
      calAccount = existingCalAccount
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

export async function buildAllUnlockDslopeIx(
  userPk: PublicKey,
  connection: Connection,
  newSchedule: Schedule,
  oldSchedule: Schedule,
  windowStartPointer:PublicKey,
  windowEndPointer: PublicKey,
): Promise<Array<any>> {
  let allIx: Array<any> = [];

  console.log("building new unlock dslope ix");
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

  // if we're dealing with a net new schedule creation, then the old schedule will be identical
  //new one. the dslope accounts for the old schedule should be the same as the dslope accounts 
  //for the new one. 
  let oldUnlockIx = [];
  let oldUnlockPointer = null;
  let oldUnlockDslope = null;
  if (oldSchedule.releaseTime.toNumber() != newSchedule.releaseTime.toNumber()) {
    console.log("building old unlock dslope ix");
    [
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
  } else {
    //the release times for the old and new schedules are identical. Set the old dlsope accounts
    //to the new dslope accounts without creating additional creation instructions.
    oldUnlockPointer = newUnlockPointer;
    oldUnlockDslope = newUnlockDslope;
  }

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
  let [firstEpochInUnlockEra, placeholder] = getEpochFromTs(firstTsInUnlockEra);
  const seedWord = getPointerSeed(firstTsInUnlockEra);
  console.log(seedWord);
  const arr = await deriveAccountInfo(
    seedWord,
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  )
  pointerAccount = new PublicKey(arr[0]);
  console.log("pointer account", pointerAccount.toString());
  const pointerSeed = arr[2];

  //get the dslope account associated with the pointer
  const dslopeArr = await deriveAccountInfo(
    getSeedWord(["dslope", pointerAccount]),
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  );
  dslopeAccount = new PublicKey(dslopeArr[0]);
  console.log("dslope account", dslopeAccount.toString());
  const dslopeSeed = dslopeArr[2];
  console.log("unlock pointerAccount", pointerAccount.toString());
  console.log("unlock window start pointer", windowStartPointer.toString());
  
  //make sure the pointer account we've derived isn't one of the ones we'll be creating
  //in an earlier instruction. Compare the string of the account public keys, not the
  //PublicKey objects.
  if (pointerAccount.toString() === windowStartPointer.toString() || pointerAccount.toString() === windowEndPointer.toString()) {
    //we don't need to actually do anything here. For this case, we just need the dslope
    //account key, which we already have above.
  } else {
    //This isn't a pointer account we'll be interacting with in this transaction.
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
        dslopeAccount,
        firstEpochInUnlockEra
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

