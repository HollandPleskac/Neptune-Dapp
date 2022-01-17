import {Button} from "react-bootstrap";
import {
  Connection, 
  PublicKey, 
  clusterApiUrl, 
} from "@solana/web3.js";
import {
  TOKEN_VESTING_PROGRAM_ID,
  NEPTUNE_MINT,
  SCHEDULE_SIZE
} from '../commands/const';
import {
  Numberu64,
  getAccountInfo,
  deriveAccountInfo,
  getVotingPower,
  getScheduleAmount,
  getScheduleReleaseDate,
  getDataAccount,
} from '../commands/utils'
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from "@project-serum/anchor";
import { Schedule } from '../commands/state';


const VestingInfoForm = (props: any) => {

  const walletContext: any = useWallet();

  const getVestingInfo = async (
  ) => {

  //get nuts and bolts
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const provider = new anchor.Provider(connection, walletContext, anchor.Provider.defaultOptions());
  const userPk = provider.wallet.publicKey
  var userBuffer = userPk.toBuffer();
  const mintPk = NEPTUNE_MINT;

  //get the key of the vesting acount based on the user's public key and the program's public key. 
  const arr = await deriveAccountInfo(
    userBuffer,
    TOKEN_VESTING_PROGRAM_ID,
    mintPk
  );
  const vestingAccountKey = arr[0];
  const vestingTokenAccountKey=arr[1];
  const seedWordBump = arr[2];

  //get and parse vesting account info
  //I'll need to nest these if statements so I have all the variables I need in scope @ the end
  const vestingAccountInfo = await getAccountInfo(
    vestingAccountKey,
    connection
  );
  if (vestingAccountInfo == null) {
    console.log("a vesting account has not been inititalized for the connected wallet");
    return null
  } else {
    console.log("vesting account key", vestingAccountKey.toString());
    const vestingAccountData = vestingAccountInfo.data;
    const destTokenAccountRaw = vestingAccountData.slice(0,32);
    const destTokenAccountKey = new PublicKey(destTokenAccountRaw);
    const tokenAccountOwnerRaw = vestingAccountData.slice(32,64);
    const tokenAccountOwnerKey = new PublicKey(tokenAccountOwnerRaw);
    const dataAccountKey = getDataAccount(vestingAccountData);
    const mintAccountRaw = vestingAccountData.slice(96, 128);
    const mintAccountFromData = new PublicKey(mintAccountRaw);

    console.log("mint address from vesting account", mintAccountFromData.toString());
    
    //get and parse token account info
    const tokenAccountInfo = await getAccountInfo(
      vestingTokenAccountKey,
      connection
    );
    if (tokenAccountInfo == null) {
      console.log("a vesting token account has not been inititalized for the connected wallet")
      console.log("we should never hit this part of the code");
      return null
    } else {
      const tokenAccountData = tokenAccountInfo.data;
      //should be the piece of token accountdata that stores the amount of token as a u64, 
      //which has a length of 8. Sources are below:
      //https://github.com/solana-labs/solana-program-library/blob/08d9999f997a8bf38719679be9d572f119d0d960/token/program/src/state.rs#L86-L106
      //https://github.com/solana-labs/solana-program-library/blob/24bb1c81589f62db6d1b8ab90b5fb89f9e8d86ea/token/js/client/token.js#L57
      const amountRaw = tokenAccountData.slice(64, 72);
      //divide because we want the human readable token amount, not lamport amount.
      const tokenAmount = Numberu64.fromBuffer(amountRaw).toNumber() / 1000000000;

      //log the data we're interested in so far
      console.log("tokens in token account", tokenAmount);
      console.log("data account key", dataAccountKey.toString());

      //get and parse data account info
      const dataAccountInfo = await getAccountInfo( 
        dataAccountKey,
        connection
      );
      if (dataAccountInfo == null) {
        console.log("a data account has not been initialized for the connected wallet");
        console.log("we should never hit this part of the code");
      } else {
        //log info about the schedules stored in the data account
        const dataAccountData = dataAccountInfo.data;
        //take all data from the 33rd index to the end of the array. We know this gives us the
        //vesting schedules based on what's saved in the data account's data. 33 bytes are taken
        //up by the Dataheader defined in programs/src/state.rs and the rest are schedules.
        const schedulesRaw = dataAccountData.slice(33);
        const isInitialized = dataAccountData.slice(32,33);
        const numOfSchedules = schedulesRaw.length / SCHEDULE_SIZE;
        const votingPower = getVotingPower(schedulesRaw, numOfSchedules);
        var offset = 0
        var i: number;
        console.log("Current voting power", votingPower);
        console.log("number of schedules", numOfSchedules);

        //iterate through schedules and print info
        for (i = 0; i < numOfSchedules; i++) {
          console.log(`schedule number ${i + 1}`);
          //slice and deserialize one schedule
          var oneRawSchedule = schedulesRaw.slice(offset, offset + SCHEDULE_SIZE);
          var oneSchedule = Schedule.fromBuffer(oneRawSchedule);

          //get release date and token amount
          var releaseDate = getScheduleReleaseDate(oneSchedule);
          console.log("release date", releaseDate);
          var releaseAmount = getScheduleAmount(oneSchedule);
          console.log("release amount", releaseAmount);
          
          //increment offset to get to next serialized schedule. 
          var offset = offset + SCHEDULE_SIZE;
        }

      }
    }
  }
  

}

  
  return (
    <>
      <Button onClick={
          async () => {

              getVestingInfo(
              );

          }
      }>
          Click to display info!
      </Button>
    </>
  );
};

export default VestingInfoForm;