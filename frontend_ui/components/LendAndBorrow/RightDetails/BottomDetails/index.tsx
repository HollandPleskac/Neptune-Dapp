import cx from 'classnames';

import InfoIcon from 'assets/InfoIcon';
import styles from './bottomDetails.module.scss';
const BottomDetails = () => {
  const data = [
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
    },
    {
      desc: 'Total APY',
      data: '4.99%',
    },
  ];
  return (
    <div className='bg-dark-primary rounded-lg p-6 mt-16 flex flex-col'>
      {data.map((d, i) => (
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
          <span className='font-bold text-white'>{d.data}</span>
        </div>
      ))}
    </div>
  );
};

export default BottomDetails;
