import cx from 'classnames';
import TriangleWhitePointer from './../../../assets/TriangleWhitePointer';
import styles from './rangeBar.module.scss';

const RangeBar = ({ indicatorPercent }: Props) => {
  const rangeBgColor = () => {
    switch (true) {
      case indicatorPercent >= 75:
        return 'red';
      case indicatorPercent >= 50:
        return '#F29637';
      default:
        return 'green';
    }
  };
  return (
    <div className="flex flex-col mt-6">
      <span className="block text-14px">Loan to Value</span>
      <div
        className="w-full h-2 relative top-5 rounded-xl rounded-xl"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)' }}
      >
        <span
          className={cx(
            'absolute left-0 right-0 w-fit text-10px mx-auto -top-6',
            styles['neptune-range-bar__has-pointer'],
          )}
        >
          Recommended
        </span>
        <span
          className={cx(
            'absolute w-fit text-10px -top-6',
            styles['neptune-range-bar__has-pointer'],
            styles['neptune-range-bar__liquidation'],
          )}
        >
          Liquidation
        </span>
        <div
          className="absolute left-0 h-2 rounded-tl-xl rounded-bl-xl"
          style={{
            width: `${indicatorPercent}%`,
            backgroundColor: rangeBgColor(),
          }}
        >
          <span className="absolute text-10px top-4" style={{ right: '-10px' }}>
            {indicatorPercent}%
          </span>
          <TriangleWhitePointer
            className={cx(
              'absolute text-10px',
              styles['neptune-range-bar__triangle-pointer'],
            )}
          />
        </div>
      </div>
    </div>
  );
};

type Props = {
  indicatorPercent: number;
};

export default RangeBar;
