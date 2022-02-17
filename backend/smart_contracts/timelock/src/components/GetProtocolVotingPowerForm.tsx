import {Button} from "react-bootstrap";
import {
  Connection, 
  PublicKey, 
  clusterApiUrl, 
} from "@solana/web3.js";
import {
  TOKEN_VESTING_PROGRAM_ID,
  NEPTUNE_MINT,
  SECONDS_IN_EPOCH,
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
  calculateProtocolVotingPower,
  getExistingCalAccount
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
  let currentEraStartTs = getEraTs(currentEpochTs);
  let [currentEraStartEpoch, placeholder] = getEpochFromTs(currentEraStartTs);
  const seed_word = getPointerSeed(currentEraStartTs);
  const arr = await deriveAccountInfo(
    seed_word,
    TOKEN_VESTING_PROGRAM_ID,
    NEPTUNE_MINT
  )

  const currentPointerAccount = arr[0];

  //get the calendar account for the current era.
  //check the info of the calendar account
  //ah, this breaks if we're not using the first calendar account created for the 
  //protocol.
  let pointerInfo = await getAccountInfo(
    currentPointerAccount,
    connection, 
  );
  let currentCalAccount = getExistingCalAccount(pointerInfo);
  const currentCalInfo = await getAccountInfo(
    currentCalAccount,
    connection, 
  );

  console.log(currentPointerAccount.toString());
  console.log(currentCalAccount.toString());

  if (currentCalInfo == null) {
    console.log("there is no calendar account for the current era")
  } else {

    //this transaction depends on having the protocol fully updated. Need to make sure that's 
    //the case before we calculate voting power. 
    const ix = await protocolOnChainVotingPower(
      connection, 
      userPk,
      currentEraStartEpoch,
      currentEpoch,
      currentEpochTs,
    );

    const tx = await signTransactionInstructions(
      connection,
      userPk,
      ix,
    );

    //get the protocol voting power now that the transaction to update the protocol has been
    //sent out. 
    let protocolVotingPower = await calculateProtocolVotingPower(
      connection,
      currentEpochTs,
      currentEraStartEpoch,
      currentEraStartTs,
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