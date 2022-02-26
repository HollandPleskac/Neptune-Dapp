import cx from 'classnames';
import TopStats from './TopStats';
import Graph from './Graph';
import styles from './topDetails.module.scss';
const TopDetails = () => {
  return (
    <div
      className={cx(
        'bg-dark-secondary rounded-2xl p-8 flex flex-col justify-between',
        styles['neptune-top-details'],
      )}
    >
      <TopStats />

      <hr className={styles['neptune-top-details__hr']} />

      <div className={styles['neptune-top-details__graph-wrapper']}>
        <div
          style={{ marginRight: '3rem' }}
          className='flex flex-col justify-between items-start'
        >
          <span className='text-xs leading-3 font-medium opacity-50'>
            Total Lent
          </span>{' '}
          <span className='font-bold text-base leading-5 mt-3'>$3,456,069</span>{' '}
          <span className='text-right block hr' />
          <span className='text-xs leading-3 font-medium opacity-50'>
            18,778.90 SOL
          </span>
        </div>
        <Graph />
        <div
          style={{ marginLeft: '3rem' }}
          className='flex flex-col justify-between items-end'
        >
          <span className='text-xs leading-3 font-medium opacity-50'>
            Total Borrowed
          </span>{' '}
          <span className='font-bold text-base leading-5 mt-3'>$1,456,069</span>{' '}
          <span className='text-right block hr' />
          <span className='text-xs leading-3 font-medium opacity-50'>
            7,911.70 SOL
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopDetails;
