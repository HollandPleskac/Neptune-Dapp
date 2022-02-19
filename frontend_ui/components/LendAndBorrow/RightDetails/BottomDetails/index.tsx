import cx from 'classnames';

import InfoIcon from 'assets/InfoIcon';
import NeptuneLogo from 'assets/NeptuneLogo';
import styles from './bottomDetails.module.scss';
import { ReactNode } from 'react';
const BottomDetails = ({ tab }: Props) => {
  const data: DataProps = [
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
      desc: 'Borrow Limit',
      data: '2,000',
      classNames: 'pt-6 border-t border-gray-fadedMost',
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

  const dataToDisplay = tab === 'Borrow' ? data : depositTab;
  return (
    <div className='bg-dark-primary rounded-lg p-6 mt-16 flex flex-col'>
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
