import cx from 'classnames';

import InfoIcon from 'assets/InfoIcon';
import NeptuneLogo from 'assets/NeptuneLogo';
import styles from './bottomDetails.module.scss';
import { ReactNode } from 'react';
const BottomDetails = ({ tab }: Props) => {
  const borrowTab: DataProps = [
    {
      desc: 'Current LTV',
      data: '37.13%',
      withIcon: true,
    },
    {
      desc: 'Max LTV',
      data: '75%',
      withIcon: true,
    },
    {
      desc: 'Liquidation LTV',
      data: '80%',
      classNames: 'pb-6 mb-0',
      withIcon: true,
    },
    {
      desc: 'Rate Type',
      data: 'Stable',
      classNames: 'pt-6 border-t border-gray-fadedMost',
      withIcon: true,
    },
    {
      desc: 'Borrow Limit',
      data: '2,000',
      withIcon: true,
    },
    {
      desc: 'Borrow APY',
      data: '-1.01%',
    },
    {
      desc: 'NPT Reward APR',
      data: '5%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
    {
      desc: 'Total APY',
      data: '4.99%',
    },
  ];

  const depositTab: DataProps = [
    {
      desc: 'Deposit Limit',
      data: '4,000,000',
      withIcon: true,
      classNames: '',
    },
    {
      desc: 'Deposit APY',
      data: '5%',
      withIcon: true,
    },
    {
      desc: 'NPT Reward APR',
      data: '3.44%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
    {
      desc: 'Total APY',
      data: '9.44%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
  ];

  const withdrawTab: DataProps = [
    {
      desc: 'Available Withdrawal',
      data: '500 SOL',
      withIcon: true,
      classNames: '',
    },
    {
      desc: 'Deposit APY',
      data: '5%',
    },
    {
      desc: 'NPT Reward APR',
      data: '3.44%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
    {
      desc: 'Total APY',
      data: '9.44%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
  ];
  const repayTab: DataProps = [
    {
      desc: 'Total SOL Borrowed',
      data: '500 SOL',
      withIcon: true,
      classNames: '',
    },
    {
      desc: 'Utilization',
      data: '50.72% -> 25.36%',
      withIcon: true,
      classNames: '',
    },
    {
      desc: 'Borrow APY',
      data: '-1.01%',
      withIcon: false,
      classNames: '',
    },
    {
      desc: 'NPT Reward APR',
      data: '5%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
    {
      desc: 'Total APY',
      data: '9.44%',
      withIcon: true,
      dataWithIcon: true,
      dataIcon: <NeptuneLogo style={{ width: 16, height: 16 }} />,
    },
  ];
  const mapper: { [key: string]: DataProps } = {
    Lend: depositTab,
    Borrow: borrowTab,
    Withdraw: withdrawTab,
    Repay: repayTab,
  };
  const dataToDisplay = mapper[tab];

  return (
    <div
      className={cx('bg-dark-primary rounded-lg p-6 flex flex-col', {
        'mt-16': tab === 'Borrow',
        'mt-6': tab !== 'Borrow',
      })}
    >
      {dataToDisplay.map((d, i) => (
        <div
          key={i}
          className={cx(
            'flex justify-between mb-4 text-gray-faded text-14px leading-17px',
            styles['neptune-right-side-bottom__details'],
            d.classNames ?? '',
          )}
        >
          <div className='flex items-center'>
            <span>{d.desc}</span>
            <span className='ml-1 inline-block'>
              {d.withIcon && <InfoIcon className='text-white' />}
            </span>
          </div>
          <div className='flex items-center'>
            <span className='font-bold text-white'>{d.data}</span>
            <span className='ml-1 inline-block'>
              {d.dataWithIcon && d.dataIcon}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

type Props = {
  tab: 'Borrow' | 'Lend' | string;
};

type DataProps = {
  desc: string;
  data: string;
  classNames?: string;
  withIcon?: boolean;
  dataWithIcon?: boolean;
  dataIcon?: ReactNode;
}[];

export default BottomDetails;
