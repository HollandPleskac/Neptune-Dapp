import cx from 'classnames';
import { useState } from 'react';
import { WalletModalButton } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

import { triggerTransaction } from 'utils/triggerTransaction';

import Button from 'components/common/Button';
import RangeBar from 'components/common/RangeBar';

import WalletDetails from './WalletDetails';
import BottomDetails from './BottomDetails';
import PercentButtons from './PercentButtons';
import InputWithPicker from './InputWithPicker';

// import SettingsIcon from 'assets/SettingsIcon';
import styles from './rightDetails.module.scss';

const RightDetails = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const defaultClassNames = 'py-3 px-4 rounded-lg leading-4 font-bold';
  const tabs = ['Lend', 'Borrow', 'Withdraw', 'Repay'];
  const [tab, setTab] = useState(tabs[1]);
  const [ltv, setLTV] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const onInputChange = (value: string) => {
    setInputValue(value);
    const ltvVal = parseInt(value) / 10;
    setLTV(ltvVal > 100 ? 100 : ltvVal);
  };

  return (
    <div className='w-dashboardRight'>
      <div className='bg-dark-secondary rounded-2xl p-8'>
        <div className='flex justify-between items-center'>
          <div className='flex justify-between rightDetails-top-buttons'>
            {tabs.map((t, i) => (
              <button
                key={i}
                onClick={() => setTab(t)}
                className={cx(defaultClassNames, {
                  'bg-blue-light text-white': tab === t,
                  'text-gray-faded': tab !== t,
                })}
              >
                {t}
              </button>
            ))}
          </div>
          {/* remove gear icon for now */}
          {/* <div className='rightDetails-top-gear flex'>
            <button>
              <SettingsIcon />
            </button>
          </div> */}
        </div>
        <hr className={styles['neptune-right-details__hr']} />
        <WalletDetails />
        <InputWithPicker
          placeholder='0'
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onInputChange(e.target.value)
          }
          inputType='number'
        />
        <PercentButtons />
        {(tab === 'Borrow' || tab === 'Repay') && (
          <RangeBar indicatorPercent={ltv} />
        )}
        <BottomDetails tab={tab} />
        {!publicKey ? (
          <WalletModalButton
            className={cx(styles['neptune-right-details__borrow-sol'])}
          >
            Connect to Wallet
          </WalletModalButton>
        ) : (
          <>
            <Button
              text={`${tab} SOL`}
              color='bg-blue-light'
              className={'neptune-button__borrow-sol'}
              onClick={() =>
                triggerTransaction({
                  inputValue,
                  publicKey,
                  connection,
                  sendTransaction,
                })
              }
            />
          </>
        )}
      </div>
    </div>
  );
};

export default RightDetails;
