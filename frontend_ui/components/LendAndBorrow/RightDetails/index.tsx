import cx from 'classnames';
import { useState } from 'react';

import Button from 'components/common/Button';
import RangeBar from 'components/common/RangeBar';

import WalletDetails from './WalletDetails';
import BottomDetails from './BottomDetails';
import PercentButtons from './PercentButtons';
import InputWithPicker from './InputWithPicker';

import SettingsIcon from 'assets/SettingsIcon';
import styles from './rightDetails.module.scss';

const RightDetails = () => {
  const defaultClassNames = 'py-3 px-4 rounded-lg leading-4 font-bold';
  const tabs = ['Lend', 'Borrow', 'Withdraw', 'Repay'];
  const [tab, setTab] = useState(tabs[1]);
  return (
    <div className='w-dashboardRight bg-dark-secondary rounded-2xl p-8'>
      <div className='flex justify-between items-center'>
        <div className='flex justify-between rightDetails-top-buttons'>
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setTab(t)}
              className={cx(defaultClassNames, {
                'bg-dark-primary text-white': tab === t,
                'text-gray-faded': tab !== t,
              })}
            >
              {t}
            </button>
          ))}
        </div>
        <div className='rightDetails-top-gear flex'>
          <button>
            <SettingsIcon />
          </button>
        </div>
      </div>
      <hr className={styles['neptune-right-details__hr']} />
      <WalletDetails />
      <InputWithPicker placeholder='250' />
      <PercentButtons />
      <RangeBar indicatorPercent={80} />
      <BottomDetails />
      <Button
        text='Borrow SOL'
        color='bg-blue-light'
        className={'neptune-button__borrow-sol'}
      />
    </div>
  );
};

export default RightDetails;
