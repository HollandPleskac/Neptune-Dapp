import TopStats from './TopStats'
import DonutGraph from './DonutGraph'
import styles from './topDetails.module.scss'
const TopDetails = () => {
  return (
    <div className="bg-dark-secondary rounded-2xl p-8 flex flex-col justify-between">
      <TopStats />

      <hr className={styles['neptune-top-details__hr']} />

      <div className={styles['neptune-top-details__graph-wrapper']}>
        <div style={{marginRight: '3rem'}}>
          Total Deposits <br />
          $3,456,069 <br />
          - <br />
          18,778.90 SOL
        </div>
        <DonutGraph />
        <div style={{marginLeft: '3rem'}}>
          Total Borrowed <br />
          $1,456,069 <br />
          - <br />
          7,911.70 SOL
        </div>
      </div>
    </div>
  )
}

export default TopDetails