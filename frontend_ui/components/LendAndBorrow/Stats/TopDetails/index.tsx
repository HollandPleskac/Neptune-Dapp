import TopStats from './TopStats';
import Graph from './Graph';
import styles from './topDetails.module.scss';
const TopDetails = () => {
  return (
    <div className="bg-dark-secondary rounded-2xl p-8 flex flex-col justify-between">
      <TopStats />

      <hr className={styles['neptune-top-details__hr']} />

      <div className={styles['neptune-top-details__graph-wrapper']}>
        <div style={{ marginRight: '3rem' }}>
          <span className="text-xs leading-3 font-medium opacity-50">
            Total Deposits
          </span>{' '}
          <br />
          <span className="font-bold text-base leading-5">$3,456,069</span>{' '}
          <hr className="w-2 opacity-50 my-3" />
          <span className="text-xs leading-3 font-medium opacity-50">
            18,778.90 SOL
          </span>
        </div>
        <Graph />
        <div style={{ marginLeft: '3rem' }}>
          <span className="text-xs leading-3 font-medium opacity-50">
            Total Borrowed
          </span>{' '}
          <br />
          <span className="font-bold text-base leading-5">$1,456,069</span>{' '}
          <hr className="w-2 opacity-50 my-3" />
          <span className="text-xs leading-3 font-medium opacity-50">
            7,911.70 SOL
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopDetails;
