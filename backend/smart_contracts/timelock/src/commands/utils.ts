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
import { Schedule } from './state';
import {MAX_BOOST, MAX_LOCK_TIME, SCHEDULE_SIZE} from './const';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import next from 'next';

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

export function getVotingPower(
  schedulesRaw: Buffer,
  numOfSchedules: number,
): number {
  //setup
  var i: number
  var votingPowerArray = []
  var offset = 0;
  var currentTimeSeconds = new Date().getTime() / 1000;
  var numOfEligibleSchedules = numOfSchedules

  //iterate through schedules to calculate voting power for each one. 
  for (i=0; i < numOfSchedules; i++) {
    //get what we need to calculate voting power
    var oneRawSchedule = schedulesRaw.slice(offset, offset + SCHEDULE_SIZE);
    var oneSchedule = Schedule.fromBuffer(oneRawSchedule);
    var releaseTimeSeconds = getScheduleReleaseDate(oneSchedule).getTime() / 1000;
    var remainingLockTime = releaseTimeSeconds - currentTimeSeconds;
    var amount = getScheduleAmount(oneSchedule);

    // need this so empty schedules don't count against the user's average voting power
    if (amount == 0) {
      numOfEligibleSchedules -= 1
    }

    var votingPower = (amount / MAX_LOCK_TIME) * remainingLockTime

    //this happens if the tokens in a schedule are claimable (ie, currentTimeSeconds > releaseTimeSeconds).
    //Those shouldn't contribute to voting power, but they shouldn't count against the user 
    //either. Just ignore them.
    if (votingPower < 0) {
      votingPower = 0
      numOfEligibleSchedules -= 1
    }

    votingPowerArray.push(votingPower)
    offset += SCHEDULE_SIZE
  }

  //sum the voting powers stored in the voting power array
  var sum = 0
  for (i=0; i< numOfSchedules; i++) {
    sum += votingPowerArray[i];
  }

  //calculate the average voting power. use eligible schedules instead of total schedules.
  const avgVotingPower = sum / numOfEligibleSchedules;
  return avgVotingPower
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
  const releaseTimeInMilliseconds = oneSchedule.releaseTime.toNumber() * 1000;
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

  seedWord = Buffer.from(seedWord.toString('hex') + bump.toString(16), 'hex');
  return [derivedAccountKey, derivedTokenAccountKey, seedWord]
}

export async function getAccountInfo(
  vestingAccountKey: PublicKey,
  connection: Connection
) {
  const check_existing = await connection.getAccountInfo(vestingAccountKey);
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
