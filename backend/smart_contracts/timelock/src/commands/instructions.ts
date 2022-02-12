import { 
  PublicKey, 
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY, 
  TransactionInstruction,
  SystemProgram
} from '@solana/web3.js';
import { Schedule } from './state';
import { connection, getAccountInfo, Numberu32, Numberu64, Numberu16 } from './utils';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { 
  TOKEN_VESTING_PROGRAM_ID,
  SECONDS_IN_WEEK,
  ZERO_EPOCH
 } from './const';
import { bytes } from '@project-serum/anchor/dist/cjs/utils';

export enum Instruction {
  Init,
  Create,
}

export function createVestingAccountInstruction(
  systemProgramId: PublicKey,
  vestingProgramId: PublicKey,
  payerKey: PublicKey,
  vestingAccountKey: PublicKey,
  seeds: Array<Buffer | Uint8Array>,
  dataAccountKey: PublicKey,
  dataAccountSeed: Array<Buffer | Uint8Array>,
  numberOfSchedules: number,
): TransactionInstruction {
  let buffers = [
    Buffer.from(Int8Array.from([0]).buffer),
    Buffer.concat(seeds),
    Buffer.concat(dataAccountSeed),
    // @ts-ignore
    new Numberu32(numberOfSchedules).toBuffer(),
  ];

  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: payerKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: dataAccountKey,
      isSigner: false,
      isWritable: true,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}

export function populateVestingAccountIx(
  vestingProgramId: PublicKey,
  tokenProgramId: PublicKey,
  vestingAccountKey: PublicKey,
  vestingTokenAccountKey: PublicKey,
  dataAccountKey: PublicKey,
  sourceTokenAccountOwnerKey: PublicKey,
  sourceTokenAccountKey: PublicKey,
  destinationTokenAccountKey: PublicKey,
  mintAddress: PublicKey,
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
  schedules: Array<Schedule>,
  seeds: Array<Buffer | Uint8Array>,
  dataAccountSeeds: Array<Buffer | Uint8Array>,
  yearsToLock: number
): TransactionInstruction {
  let buffers = [
    Buffer.from(Int8Array.from([1]).buffer),
    Buffer.concat(seeds),
    Buffer.concat(dataAccountSeeds),
    destinationTokenAccountKey.toBuffer(),
    Buffer.from(Float32Array.from([yearsToLock]).buffer),
  ];

  schedules.forEach(s => {
    buffers.push(s.toBuffer());
  });

  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: tokenProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: vestingTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: sourceTokenAccountOwnerKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: sourceTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: dataAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mintAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowStartPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowStartCal,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowStartDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowEndPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowEndCal,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowEndDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newUnlockPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: newUnlockDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: oldUnlockPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: oldUnlockDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}

export function createUnlockInstruction(
  vestingProgramId: PublicKey,
  tokenProgramId: PublicKey,
  clockSysvarId: PublicKey,
  vestingAccountKey: PublicKey,
  vestingTokenAccountKey: PublicKey,
  destinationTokenAccountKey: PublicKey,
  dataAccount: PublicKey,
  vestingAccountSeeds: Array<Buffer | Uint8Array>,
): TransactionInstruction {
  const data = Buffer.concat([
    Buffer.from(Int8Array.from([2]).buffer),
    Buffer.concat(vestingAccountSeeds),
  ]);

  const keys = [
    {
      pubkey: tokenProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: clockSysvarId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: vestingTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: destinationTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: dataAccount,
      isSigner: false,
      isWritable: true,
    },
  ];
  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}

export function createNewDataAccountInstruction(
  vestingProgramId: PublicKey,
  vestingAccountKey: PublicKey,
  sourceTokenOwner: PublicKey,
  systemProgramId: PublicKey,
  schedules: Array<Schedule>,
  vestingAccountSeed: Array<Buffer | Uint8Array>,
  oldDataAccountKey: PublicKey,
  newDataAccountKey: PublicKey,
  newDataAccountSeed: Array<Buffer | Uint8Array>,
): TransactionInstruction {

  console.log("schedules to add", schedules);

  let buffers = [
    Buffer.from(Int8Array.from([3]).buffer),
    Buffer.concat(vestingAccountSeed),
    Buffer.concat(newDataAccountSeed),
  ];

  schedules.forEach(s => {
    buffers.push(s.toBuffer());
  });
  
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: sourceTokenOwner,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: systemProgramId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: oldDataAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newDataAccountKey,
      isSigner: false,
      isWritable: true,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}

export function populateNewDataAccountInstruction(
  vestingProgramId: PublicKey,
  vestingAccountKey: PublicKey,
  vestingTokenAccountKey: PublicKey,
  sourceTokenOwner: PublicKey,
  sourceTokenAccount: PublicKey,
  schedules: Array<Schedule>,
  vestingAccountSeed: Array<Buffer | Uint8Array>,
  oldDataAccountKey: PublicKey,
  newDataAccountKey: PublicKey,
  newDataAccountSeed: Array<Buffer | Uint8Array>,
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
  amountToLock: number,
  decimals: any

): TransactionInstruction {
  console.log("schedules to add", schedules);
  console.log("amount to add", amountToLock);
  console.log("lamport amount to add", amountToLock * Math.pow(10, decimals))

  let buffers = [
    Buffer.from(Int8Array.from([4]).buffer),
    Buffer.concat(vestingAccountSeed),
    Buffer.concat(newDataAccountSeed),
    //convert the amount to add to lamports. 
    new Numberu64(amountToLock * Math.pow(10, decimals)).toBuffer()
  ];

  schedules.forEach(s => {
    buffers.push(s.toBuffer());
  });
  
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: vestingAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: vestingTokenAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: sourceTokenOwner,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: sourceTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: oldDataAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newDataAccountKey,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowStartPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowStartCal,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowStartDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowEndPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowEndCal,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowEndDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: newUnlockPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: newUnlockDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: oldUnlockPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: oldUnlockDslope,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: vestingProgramId,
    data,
  });
}

export function userOnChainVotingPowerIx(
  userPk: PublicKey,
  vestingAccount: PublicKey,
  dataAccount: PublicKey,
  vestingAccountSeed: Array<Buffer | Uint8Array>,
  clientVotingPower: number
): TransactionInstruction {



  let buffers = [
    Buffer.from(Int8Array.from([23]).buffer), //len 1
    Buffer.concat(vestingAccountSeed), //len 32
    //Buffer.from(Float32Array.from([clientVotingPower]).buffer) //len 4
    new Numberu64(clientVotingPower).toBuffer() //len 8
  ];
  
  const data = Buffer.concat(buffers);

  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: vestingAccount,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: dataAccount,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });
}

export function protocolOnChainVotingPowerIx(
  windowStartPointer: PublicKey,
  windowStartCal: PublicKey,
  windowStartDslope: PublicKey,
  windowEndPointer: PublicKey,
  windowEndCal: PublicKey,
  windowEndDslope: PublicKey,
  clientVotingPower: number
): TransactionInstruction {

  let buffers = [
    Buffer.from(Int8Array.from([24]).buffer), //len 1
    //Buffer.from(Float32Array.from([clientVotingPower]).buffer) //len 4
    new Numberu64(clientVotingPower).toBuffer() //len 8
  ];
  
  const data = Buffer.concat(buffers);

  //calendars should be writable for this transaction: we may file new points to them. 
  const keys = [
    {
      pubkey: windowStartPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowStartCal,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowStartDslope,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowEndPointer,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: windowEndCal,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: windowEndDslope,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });
}

export function newCalendarIx(
  userPk: PublicKey,
  calAccount: PublicKey,
  seed: Array<Buffer| Uint8Array>,
  calAccountSize: number,
  firstEpochInEra: number,
): Array<TransactionInstruction> {
  let ixs = [
    createCalendarIx(
      userPk,
      calAccount,
      seed,
      calAccountSize,
    ),
    populateCalendarIx(
      userPk,
      calAccount,
      firstEpochInEra,
    )
  ]
  return ixs
}

export function createCalendarIx(
  userPk: PublicKey,
  cal_account: PublicKey,
  seed: Array<Buffer | Uint8Array>,
  accountSize: number,
): TransactionInstruction {
  let buffers = [
    Buffer.from(Int8Array.from([5]).buffer), //len 1
    Buffer.concat(seed), //len 32
    new Numberu64(accountSize).toBuffer()
  ];
  console.log("cal account size is ", accountSize);
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: cal_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ]

  return new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });
}

export function populateCalendarIx(
  userPk: PublicKey,
  calAccount: PublicKey,
  firstEpochInEra: number
): TransactionInstruction {
  let buffers = [
    Buffer.from(Int8Array.from([6]).buffer), //len 1
    new Numberu16(firstEpochInEra).toBuffer()
  ];
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: calAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SYSVAR_CLOCK_PUBKEY,
      isSigner: false,
      isWritable: true,
    },
  ]

  return new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });
}

export function newPointerIx(
  userPk: PublicKey,
  pointer_account: PublicKey,
  seed: Array<Buffer| Uint8Array>,
  cal_account: PublicKey,
  dslope_account: PublicKey,
  firstEpochInEra: number,
): Array<TransactionInstruction> {
  let ixs = [
    createPointerIx(
      userPk,
      pointer_account,
      seed
    ),
    populatePointerIx(
      userPk,
      pointer_account,
      cal_account,
      dslope_account,
      firstEpochInEra,
    )
  ]
  return ixs
}

export function createDslopeIx(
  userPk: PublicKey,
  dslope_account: PublicKey,
  seed: Array<Buffer | Uint8Array>,
): Array<TransactionInstruction> {
  console.log("dslope seed", seed);
  let buffers = [
    Buffer.from(Int8Array.from([7]).buffer), //len 1
    Buffer.concat(seed), //len 32 (?)
  ];
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: dslope_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ]

  let ix = new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });

  return [ix]
}

export function createPointerIx(
  userPk: PublicKey,
  pointer_account: PublicKey,
  seed: Array<Buffer | Uint8Array>,
): TransactionInstruction {
  console.log("pointer seed in the bottom layer", seed);
  let buffers = [
    Buffer.from(Int8Array.from([8]).buffer), //len 1
    Buffer.concat(seed), //len 32
  ];
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: pointer_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ]

  return new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });
}

export function populatePointerIx(
  userPk: PublicKey,
  pointer_account: PublicKey,
  cal_account: PublicKey,
  dslope_account: PublicKey,
  firstEpochInEra: number,
): TransactionInstruction {
  let buffers = [
    Buffer.from(Int8Array.from([9]).buffer), //len 1
    new Numberu16(firstEpochInEra).toBuffer() //len 2
  ];
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: pointer_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: cal_account,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: dslope_account,
      isSigner: false,
      isWritable: false,
    },
  ]

  return new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });
}

export function transferCalendarDataIx(
  userPk: PublicKey,
  pointer_account: PublicKey,
  new_cal_account: PublicKey,
  new_cal_seed:  Array<Buffer | Uint8Array>,
  old_cal_account: PublicKey,
): Array<TransactionInstruction> {
  let buffers = [
    Buffer.from(Int8Array.from([10]).buffer), //len 1
    Buffer.concat(new_cal_seed), //len 32
  ];
  const data = Buffer.concat(buffers);
  const keys = [
    {
      pubkey: userPk,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: pointer_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new_cal_account,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: old_cal_account,
      isSigner: false,
      isWritable: false,
    },
  ]

  let ix = new TransactionInstruction({
    keys,
    programId: TOKEN_VESTING_PROGRAM_ID,
    data,
  });

  return [ix]
}
