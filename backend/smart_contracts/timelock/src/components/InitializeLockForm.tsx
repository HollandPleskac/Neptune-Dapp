import {Button} from "react-bootstrap";
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Connection, 
  PublicKey, 
  Keypair, 
  clusterApiUrl, 
  TransactionInstruction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  SECONDS_IN_YEAR,
  TOKEN_VESTING_PROGRAM_ID,
  MAX_BOOST,
  NEPTUNE_MINT,
  SECONDS_IN_WEEK
} from '../commands/const';
import {
  Numberu64,
  signTransactionInstructions,
  findAssociatedTokenAddress,
  getBoost,
  deriveAccountInfo,
  getMintDecimals,
  transferInstructions,
  getZeroSchedule,
  getAccountInfo,
  Numberu16,
  getEpochFromTs
} from '../commands/utils'
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from "@project-serum/anchor";
import { Schedule } from '../commands/state';
import { 
    createVestingAccount,
    add,
    buildPointerAndCalendarIx 
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
  let [unlockEpoch, unlockEpochTs] = getEpochFromTs(unlockDateInSeconds.toNumber())
  console.log('locking ', amountToLock, ' tokens for ',yearsToLock,' years.')
  let normalizedUnlockDateMilliseconds = unlockEpochTs * 1000
  let unlockDate = new Date(normalizedUnlockDateMilliseconds);
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

  //what needs to be done here?
    //find the week simplified timestamp of right now (C)
    //find the pointer account for the timeframe that includes right now (C)
      //create a pointer account for the current timeframe if it doesn't exist. (one T)
      //if the pointer account for the current timeframe doesn't exist, also create a calendar account and a schedule account to be stored within it. (1T)
      //populate the new calenar account and schedule with data (1T each). For the schedule account, just load it with an epoch's worth of data. 
    //get the calendar account for the pointer account (C)
    //deserialize the calendar. find out if there is an existing point for the current timestamp in the calendar (C)
      //if there isn't an existing point in the calendar, create a new calendar account to be stored in the pointer (1T)
        //find the week simplified timestamp of when the user's tokens will be unlocked for this schedule (C)
    //find the pointer account for the timeframe the user's tokens will be unlocked (C)
      //create a pointer account for the unlock timeframe if it doesn't exist (one T)
      //if the pointer account for the unlock timeframe doesn't exist, also create a calendar account to be stored in it (1T)
    //Final transaction: this one will.
      //save the new lock data to the user's data account. 
      //Update the calendar account we've found for the current time. May involve updating other calendars as well. 
      //update dslope for the unlock time

  const lock = async () => {

    var allInstructions: Array<TransactionInstruction> = [];

    await checks();

    let [currentEpoch, currentEpochTs] = getEpochFromTs(todaysDateInSeconds.toNumber())
    //create the new schedule object now that we have all of the pieces that we need. 
    const schedules = createSchedules(
      unlockEpochTs,
      amountToLock,
      decimals,
      currentEpoch
    );

    //TODO: since we're just creating a net new unlock, we can consider the old schedule to be
    //the same as the new schedule like Curve does. But we'll need to handle this more gracefully
    //when the time comes. 
    let newSchedule = schedules[0];
    let oldSchedule = newSchedule;

    //POINTER + CALENDAR ACCOUNT HANDLING
    //these make sure that we have all the pointer and calendar accounts we'll need
    //for future transactions. 
    const [
      pointerAndCalendarInstructions,
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
    ] = await buildPointerAndCalendarIx(
      userPk,
      connection,
      oldSchedule,
      newSchedule,
      currentEpoch,
      currentEpochTs,
    );
    allInstructions = transferInstructions(pointerAndCalendarInstructions, allInstructions);

    //VESTING ACCOUNT HANDLING
    //get the key of the vesting acount based on the user's public key and the program's public key.
    var userBuffer = userPk.toBuffer();
    const arr = await deriveAccountInfo(
      userBuffer,
      TOKEN_VESTING_PROGRAM_ID,
      mintPk
    );
    const vestingAccountKey = arr[0];
    const vestingTokenAccountKey=arr[1];
    const seedWordBump = arr[2];
    console.log("vesting account key", vestingAccountKey.toString());
    const vesting_account_check = await getAccountInfo(vestingAccountKey, connection);
    console.log("vesting account info ", vesting_account_check);

    var dataAccountKey: any = "";
    if (vesting_account_check == null) {
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
      console.log( {
        vestingProgram: TOKEN_VESTING_PROGRAM_ID.toString(),
        seedWordBump,
        userPk:userPk.toString(),
        userTokenPk: userTokenAccountPk.toString(),
        mintPk: mintPk.toString(),
        schedules,
        amountToLock,
        vestingAccount: vestingAccountKey.toString(),
        VestingTokenAccount: vestingTokenAccountKey.toString(),
        dataAccount:dataAccountKey.toString(),
        dataAccountSeed,
        yearsToLock,
        windowStartPointer: windowStartPointer.toString(),
        windowStartCal: windowStartCal.toString(),
        windowStartDslope: windowStartDslope.toString(),
        windowEndPointer: windowEndPointer.toString(),
        windowEndCal: windowEndCal.toString(),
        windowEndDslope: windowEndDslope.toString(),
        newUnlockPointer: newUnlockPointer.toString(),
        newUnlockDslope: newUnlockDslope.toString(),
        oldUnlockPointer:oldUnlockPointer.toString(),
        oldUnlockDslope: oldUnlockDslope.toString(),
      })

      var createVestingInstructions = await createVestingAccount(
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
        yearsToLock,
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
      );
      allInstructions = transferInstructions(createVestingInstructions, allInstructions);

    } else {
      console.log("Adding token schedules to this user's vesting account!");
      //if the user does have a Neptune vesting account, then add the new schedules to it.
      //we'll need to create a net new data account to store the new schedule information.

      //get the old data account from the vesting account data. 
      const vestingAccountData = vesting_account_check.data;
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

      console.log( {
        vestingProgram: TOKEN_VESTING_PROGRAM_ID.toString(),
        seedWordBump,
        userPk:userPk.toString(),
        userTokenPk: userTokenAccountPk.toString(),
        mintPk: mintPk.toString(),
        schedules,
        amountToLock,
        vestingAccount: vestingAccountKey.toString(),
        VestingTokenAccount: vestingTokenAccountKey.toString(),
        oldDataAccount: oldDataAccountKey.toString(),
        newDataAccount: newDataAccountKey.toString(),
        yearsToLock,
        windowStartPointer: windowStartPointer.toString(),
        windowStartCal: windowStartCal.toString(),
        windowStartDslope: windowStartDslope.toString(),
        windowEndPointer: windowEndPointer.toString(),
        windowEndCal: windowEndCal.toString(),
        windowEndDslope: windowEndDslope.toString(),
        newUnlockPointer: newUnlockPointer.toString(),
        newUnlockDslope: newUnlockDslope.toString(),
        oldUnlockPointer:oldUnlockPointer.toString(),
        oldUnlockDslope: oldUnlockDslope.toString(),
      })

      var userDataAccountIx = await add(
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
        decimals,
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
      )
      allInstructions = transferInstructions(userDataAccountIx, allInstructions);
    };

    console.log("instruction successful", allInstructions);
  
    const tx = await signTransactionInstructions(
      connection,
      userPk,
      allInstructions,
    );

    const account_check_post = await getAccountInfo(vestingAccountKey, connection);
    console.log("vesting account data post create transaction", account_check_post);
    const data_check_post = await getAccountInfo(dataAccountKey, connection);
    console.log("data account data post create transaction", data_check_post);
  
    console.log(`Transaction for token locking: ${tx}`);
  };
  
  lock();

  function createSchedules(
    unlockEpochTs: any,
    amountToLock: any,
    decimals: any,
    currentEpoch: number,
  ) {
    const schedules: Schedule[] = [];
    //we unlock all the tokens at the end date, so we only have one unlock date
    schedules.push(
      new Schedule(
        /** Timestamp of unlock in seconds*/
        new Numberu64(unlockEpochTs),
        /** Don't forget to add decimals */
        new Numberu64(amountToLock * Math.pow(10, decimals)),
        //store the epoch we created the schedule in
        new Numberu16(currentEpoch)
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