import {Button} from "react-bootstrap";
import {
  Connection, 
  PublicKey, 
  clusterApiUrl, 
} from "@solana/web3.js";
import {
  TOKEN_VESTING_PROGRAM_ID,
  NEPTUNE_MINT,
  SECONDS_IN_WEEK,
} from '../commands/const';
import {
  Numberu64,
  getAccountInfo,
  deriveAccountInfo,
  getScheduleAmount,
  getScheduleReleaseDate,
  signTransactionInstructions,
  getPointerSeed,
  getEraTs,
  getSeedWord,
  getLastFiledPoint,
  getEpochFromTs,
  getEmptySchedule,
} from '../commands/utils';
import { protocolOnChainVotingPower, buildAllWindowIx } from "commands/main";
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from "@project-serum/anchor";
//import { protocolOnChainVotingPower } from "commands/main";
import { Schedule } from '../commands/state';


const ProtocolVotingPowerForm = (props: any) => {

  const walletContext: any = useWallet();

  const getProtocolVotingPower = async (
  ) => {
    console.log("getting on chain voting power for the protocol!");

  //get nuts and bolts
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const provider = new anchor.Provider(connection, walletContext, anchor.Provider.defaultOptions());
  const userPk = provider.wallet.publicKey
  var userBuffer = userPk.toBuffer();
  const mintPk = NEPTUNE_MINT;

  //get the pointer account for the current era.
  let todaysDate = new Date();
  let todaysDateInSeconds = new Numberu64(todaysDate.getTime() / 1_000).toNumber();
  let [currentEpoch, currentEpochTs] = getEpochFromTs(todaysDateInSeconds);
  const currentEraStartTs = getEraTs(currentEpochTs);
  const currentEraStartEpoch = currentEraStartTs / SECONDS_IN_WEEK;
  const seed_word = getPointerSeed(currentEraStartTs);
  const arr = await deriveAccountInfo(
    seed_word,
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  )

  const currentPointerAccount = arr[0];

  //get the calendar account for the current era.
  //check the info of the calendar account
  const calArr = await deriveAccountInfo(
    getSeedWord(["calendar", currentPointerAccount]),
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  );
  let currentCalAccount = calArr[0];
  const currentCalInfo = await getAccountInfo(
    currentCalAccount,
    connection, 
  );

  if (currentCalInfo == null) {
    console.log("there is no calendar account for the current era")
  } else {

    const ix = await protocolOnChainVotingPower(
      connection, 
      userPk,
      currentEraStartEpoch,
      currentEpoch,
      currentEpochTs
    );
      //send transaction
    const tx = await signTransactionInstructions(
      connection,
      userPk,
      ix,
    );

    console.log("check the program log of the solana explorer to see the on chain voting power");
    console.log(`Transaction for voting power test: ${tx}`);
  
  }
}

  
  return (
    <>
      <Button onClick={
          async () => {

              getProtocolVotingPower(
              );

          }
      }>
          Click to return the protocol's on chain voting power!
      </Button>
    </>
  );
};

export default ProtocolVotingPowerForm;