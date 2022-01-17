import {Button} from "react-bootstrap";
import {
  Connection, 
  PublicKey, 
  Keypair, 
  clusterApiUrl, 
  TransactionInstruction
} from "@solana/web3.js";
import {
  SECONDS_IN_YEAR,
  TOKEN_VESTING_PROGRAM_ID,
  MAX_BOOST,
  NEPTUNE_MINT
} from '../commands/const';
import {
  Numberu64,
  generateRandomSeed,
  signTransactionInstructions,
  findAssociatedTokenAddress,
  getBoost,
  getAccountInfo,
  deriveAccountInfo,
  getMintDecimals
} from '../commands/utils'
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from "@project-serum/anchor";
import { Schedule } from '../commands/state';
import { 
    createVestingAccount,
    add 
} from '../commands/main';
import axios from "axios";
import bs58 from 'bs58';

const InitializeLockForm = (props: any) => {

  const walletContext: any = useWallet();

  const initializeLock = async (
  ) => {
  
  const react1=require('react');
  const react2 = require('react');
  console.log("slider amount", props.yearsToLock);
  const mintPk = NEPTUNE_MINT;
  console.log("mint PK", mintPk);
  const yearsToLock = props.yearsToLock;
  const amountToLock = props.amountToLock;
 

  //find out how long we'll be locking the tokens for
  let todaysDate = new Date();
  let todaysDateInSeconds = new Numberu64(todaysDate.getTime() / 1_000);
  let secondsToLock = new Numberu64(SECONDS_IN_YEAR * yearsToLock);
  let unlockDateInSeconds = todaysDateInSeconds.add(secondsToLock);
  console.log('locking ', amountToLock, ' tokens for ',yearsToLock,' years.')
  let unlockDateInSecondsNum = (unlockDateInSeconds.toNumber());
  let unlockDateInMilliseconds = unlockDateInSecondsNum * 1000;
  let unlockDate = new Date(unlockDateInMilliseconds);
  console.log('the tokens will be claimable on ', unlockDate );

  //get the boost amount
  const boost = getBoost(yearsToLock, amountToLock);

  console.log("qualify for a boost of ", boost);


  //web3 setup
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const provider = new anchor.Provider(connection, walletContext, anchor.Provider.defaultOptions());
  const userPk = provider.wallet.publicKey
  //TODO - get the sender's token account and the decimals of the mint
  const userTokenAccountPk: PublicKey = await findAssociatedTokenAddress(
    userPk,
    mintPk
  );
  console.log("sender's token account public key is ", userTokenAccountPk);

  const mintInfo = await connection.getAccountInfo(
    mintPk,
  );

  console.log("mint info", mintInfo);

  const decimals = getMintDecimals(mintInfo);
  console.log("decimals", decimals);

  const checks = async () => {
    const tokenInfo = await connection.getParsedAccountInfo(
      userTokenAccountPk,
    );
  
    // @ts-ignore
    const parsed = tokenInfo.value.data.parsed;
    if (parsed.info.mint !== mintPk.toBase58()) {
      throw new Error('Invalid mint');
    }
    if (parsed.info.owner !== userPk.toBase58()) {
      throw new Error('Invalid owner');
    }
    if (parsed.info.tokenAmount.decimals !== decimals) {
      throw new Error('Invalid decimals');
    }
  };
  

  /** Function that locks the tokens */
  const lock = async () => {
    await checks();

    const schedules = createSchedules(
      unlockDate,
      amountToLock,
      decimals
    );

    var userBuffer = userPk.toBuffer();

    //get the key of the vesting acount based on the user's public key and the program's public key. 
    const arr = await deriveAccountInfo(
      userBuffer,
      TOKEN_VESTING_PROGRAM_ID,
      mintPk
    );
    const vestingAccountKey = arr[0];
    const vestingTokenAccountKey=arr[1];
    const seedWordBump = arr[2];

    console.log("vesting account key", vestingAccountKey.toString());

    const account_check = await getAccountInfo(vestingAccountKey, connection);
    var instruction: Array<TransactionInstruction> = [];
    var dataAccountKey: any = "";
    if (account_check == null) {
      //if the user doesn't have a Neptune vesting account, create one
      //also create a data account to store the schedule data.
      console.log("creating a vesting account for this user!");
      const dataArr = await deriveAccountInfo(
        vestingAccountKey.toBuffer(),
        TOKEN_VESTING_PROGRAM_ID,
        mintPk
      );
      var dataAccountKey = dataArr[0];
      const dataAccountSeed = dataArr[2];

      console.log("data account key", dataAccountKey.toString());
      console.log("schedules", schedules);
      var instruction = await createVestingAccount(
        TOKEN_VESTING_PROGRAM_ID,
        seedWordBump,
        userPk,
        userPk,
        userTokenAccountPk,
        userTokenAccountPk,
        mintPk,
        schedules,
        amountToLock,
        vestingAccountKey,
        vestingTokenAccountKey,
        dataAccountKey,
        dataAccountSeed,
        yearsToLock
      );
    } else {
      console.log("Adding token schedules to this user's vesting account!");
      //if the user does have a Neptune vesting account, then add the new schedules to it.
      //we'll need to create a net new data account to store the new schedule information.

      //get the old data account from the vesting account data. 
      const vestingAccountData = account_check.data;
      const oldDataAccountKeyRaw = vestingAccountData.slice(64,96);
      const oldDataAccountKey = new PublicKey(oldDataAccountKeyRaw);
      console.log("old data account key", oldDataAccountKey.toString());

      //then, derive the key for a new data account based on the pubkey of the old data account
      const newDataArr = await deriveAccountInfo(
        oldDataAccountKey.toBuffer(),
        TOKEN_VESTING_PROGRAM_ID,
        mintPk
      );
      var newDataAccountKey = newDataArr[0];
      const newDataAccountSeed = newDataArr[2];
      console.log("new data account key", newDataAccountKey.toString());
      console.log("new data account seeds", newDataAccountSeed);
      //console.log("new data account seeds alt", bs58.encode(newDataAccountSeed));
      var instruction = await add(
        TOKEN_VESTING_PROGRAM_ID,
        seedWordBump,
        userPk,
        userTokenAccountPk,
        mintPk,
        schedules,
        vestingAccountKey,
        vestingTokenAccountKey,
        oldDataAccountKey,
        newDataAccountKey,
        newDataAccountSeed,
        amountToLock,
        decimals
      )
    };

    console.log("instruction successful", instruction);
  
    const tx = await signTransactionInstructions(
      connection,
      userPk,
      instruction,
    );

    const account_check_post = await getAccountInfo(vestingAccountKey, connection);
    console.log("vesting account data post create transaction", account_check_post);
    const data_check_post = await getAccountInfo(dataAccountKey, connection);
    console.log("data account data post create transaction", data_check_post);
  
    console.log(`Transaction for token locking: ${tx}`);
  };
  
  lock();

  function createSchedules(
    unlockDate: any,
    amountToLock: any,
    decimals: any
  ) {
    const schedules: Schedule[] = [];
    //we unlock all the tokens at the end date, so we only have one unlock date
    schedules.push(
      new Schedule(
        /** Has to be in seconds */
        new Numberu64(unlockDate.getTime() / 1_000),
        /** Don't forget to add decimals */
        new Numberu64(amountToLock * Math.pow(10, decimals)),
      ),
    );
    return schedules
  }

}

  
  return (
    <>
      <Button onClick={
          async () => {

              initializeLock(
              );

          }
      }>
          Click to lock tokens!
      </Button>
    </>
  );
};

export default InitializeLockForm;