#![cfg(feature = "test-bpf")]

mod helpers;

use {
    helpers::*,
    solana_program::hash::Hash,
    solana_program_test::*,
    solana_sdk::{
        borsh::try_from_slice_unchecked,
        instruction::InstructionError,
        pubkey::Pubkey,
        signature::{Keypair, Signer},
        transaction::{Transaction, TransactionError},
    },
    spl_stake_pool::{
        error, id,
        instruction::{self, PreferredValidatorType},
        state::ValidatorList,
    },
};

async fn setup() -> (
    BanksClient,
    Keypair,
    Hash,
    StakePoolAccounts,
    ValidatorStakeAccount,
) {
    let (mut banks_client, payer, recent_blockhash) = program_test().start().await;
    let stake_pool_accounts = StakePoolAccounts::new();
    stake_pool_accounts
        .initialize_stake_pool(&mut banks_client, &payer, &recent_blockhash, 1)
        .await
        .unwrap();

    let validator_stake_account = simple_add_validator_to_pool(
        &mut banks_client,
        &payer,
        &recent_blockhash,
        &stake_pool_accounts,
    )
    .await;

    (
        banks_client,
        payer,
        recent_blockhash,
        stake_pool_accounts,
        validator_stake_account,
    )
}

#[tokio::test]
async fn success_deposit() {
    let (mut banks_client, payer, recent_blockhash, stake_pool_accounts, validator_stake_account) =
        setup().await;

    let vote_account_address = validator_stake_account.vote.pubkey();
    let error = stake_pool_accounts
        .set_preferred_validator(
            &mut banks_client,
            &payer,
            &recent_blockhash,
            PreferredValidatorType::Deposit,
            Some(vote_account_address),
        )
        .await;
    assert!(error.is_none());

    let validator_list = get_account(
        &mut banks_client,
        &stake_pool_accounts.validator_list.pubkey(),
    )
    .await;
    let validator_list =
        try_from_slice_unchecked::<ValidatorList>(&validator_list.data.as_slice()).unwrap();

    assert_eq!(
        validator_list.preferred_deposit_validator_vote_address,
        Some(vote_account_address)
    );
    assert_eq!(
        validator_list.preferred_withdraw_validator_vote_address,
        None
    );
}

#[tokio::test]
async fn success_withdraw() {
    let (mut banks_client, payer, recent_blockhash, stake_pool_accounts, validator_stake_account) =
        setup().await;

    let vote_account_address = validator_stake_account.vote.pubkey();

    let error = stake_pool_accounts
        .set_preferred_validator(
            &mut banks_client,
            &payer,
            &recent_blockhash,
            PreferredValidatorType::Withdraw,
            Some(vote_account_address),
        )
        .await;
    assert!(error.is_none());

    let validator_list = get_account(
        &mut banks_client,
        &stake_pool_accounts.validator_list.pubkey(),
    )
    .await;
    let validator_list =
        try_from_slice_unchecked::<ValidatorList>(&validator_list.data.as_slice()).unwrap();

    assert_eq!(
        validator_list.preferred_deposit_validator_vote_address,
        None
    );
    assert_eq!(
        validator_list.preferred_withdraw_validator_vote_address,
        Some(vote_account_address)
    );
}

#[tokio::test]
async fn success_unset() {
    let (mut banks_client, payer, recent_blockhash, stake_pool_accounts, validator_stake_account) =
        setup().await;

    let vote_account_address = validator_stake_account.vote.pubkey();
    let error = stake_pool_accounts
        .set_preferred_validator(
            &mut banks_client,
            &payer,
            &recent_blockhash,
            PreferredValidatorType::Withdraw,
            Some(vote_account_address),
        )
        .await;
    assert!(error.is_none());

    let validator_list = get_account(
        &mut banks_client,
        &stake_pool_accounts.validator_list.pubkey(),
    )
    .await;
    let validator_list =
        try_from_slice_unchecked::<ValidatorList>(&validator_list.data.as_slice()).unwrap();

    assert_eq!(
        validator_list.preferred_withdraw_validator_vote_address,
        Some(vote_account_address)
    );

    let error = stake_pool_accounts
        .set_preferred_validator(
            &mut banks_client,
            &payer,
            &recent_blockhash,
            PreferredValidatorType::Withdraw,
            None,
        )
        .await;
    assert!(error.is_none());

    let validator_list = get_account(
        &mut banks_client,
        &stake_pool_accounts.validator_list.pubkey(),
    )
    .await;
    let validator_list =
        try_from_slice_unchecked::<ValidatorList>(&validator_list.data.as_slice()).unwrap();

    assert_eq!(
        validator_list.preferred_withdraw_validator_vote_address,
        None
    );
}

#[tokio::test]
async fn fail_wrong_staker() {
    let (mut banks_client, payer, recent_blockhash, stake_pool_accounts, _) = setup().await;

    let wrong_staker = Keypair::new();
    let transaction = Transaction::new_signed_with_payer(
        &[instruction::set_preferred_validator(
            &id(),
            &stake_pool_accounts.stake_pool.pubkey(),
            &wrong_staker.pubkey(),
            &stake_pool_accounts.validator_list.pubkey(),
            PreferredValidatorType::Withdraw,
            None,
        )],
        Some(&payer.pubkey()),
        &[&payer, &wrong_staker],
        recent_blockhash,
    );
    let error = banks_client
        .process_transaction(transaction)
        .await
        .err()
        .unwrap()
        .unwrap();

    match error {
        TransactionError::InstructionError(_, InstructionError::Custom(error_index)) => {
            let program_error = error::StakePoolError::WrongStaker as u32;
            assert_eq!(error_index, program_error);
        }
        _ => panic!("Wrong error occurs while malicious try to set manager"),
    }
}

#[tokio::test]
async fn fail_not_present_validator() {
    let (mut banks_client, payer, recent_blockhash, stake_pool_accounts, _) = setup().await;

    let validator_vote_address = Pubkey::new_unique();
    let error = stake_pool_accounts
        .set_preferred_validator(
            &mut banks_client,
            &payer,
            &recent_blockhash,
            PreferredValidatorType::Withdraw,
            Some(validator_vote_address),
        )
        .await
        .unwrap()
        .unwrap();

    match error {
        TransactionError::InstructionError(_, InstructionError::Custom(error_index)) => {
            let program_error = error::StakePoolError::ValidatorNotFound as u32;
            assert_eq!(error_index, program_error);
        }
        _ => panic!("Wrong error occurs while malicious try to set manager"),
    }
}
