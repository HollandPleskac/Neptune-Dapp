import cx from 'classnames'
import styles from './bottomDetails.module.scss'
const BottomDetails = () => {
  const data = [
    {
      desc: 'Current LTV',
      data: '37.13%'
    },
    {
      desc: 'Max LTV',
      data: '75%'
    },
    {
      desc: 'Liquidation LTV',
      data: '80%'
    },
    {
      desc: 'Borrow Limit',
      data: '2,000'
    },
    {
      desc: 'Borrow APY',
      data: '-1.01%'
    },
    {
      desc: 'NPT Reward APR',
      data: '5%'
    },
    {
      desc: 'Total APY',
      data: '4.99%'
    },
  ]
  return (
    <div className="bg-dark-primary rounded-lg p-6 mt-16 flex flex-col">
      {data.map((d, i) => (
        <div key={i} className={cx("flex justify-between mb-4", 
          styles['neptune-right-side-bottom__details'])}>
          <span>{d.desc}</span>
          <span>{d.data}</span>
        </div>
      ))}    
    </div>
  )
}

export default BottomDetails