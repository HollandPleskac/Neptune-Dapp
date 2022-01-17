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
  onChainVotingPowerTestInstruction
} from './instructions';
import {
  findAssociatedTokenAddress,
  createAssociatedTokenAccount,
  getAccountInfo,
  deriveAccountInfo,
  getDataAccount,
  getVotingPower
} from './utils';
import { ContractInfo, Schedule } from './state';
import { assert } from 'console';
import bs58 from 'bs58';
import { SCHEDULE_SIZE } from './const';

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
