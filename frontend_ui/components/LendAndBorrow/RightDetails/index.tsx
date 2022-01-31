import WalletDetails from './WalletDetails'
import RangeBar from '../../common/RangeBar'
import PercentButtons from './PercentButtons'
import InputPicker from '../../common/InputPicker'
import SettingsIcon from './../../../assets/SettingsIcon'
import styles from './rightDetails.module.scss'

const RightDetails = () => {
  return (
    <div className="w-dashboardRight bg-dark-secondary rounded-2xl p-8">
      <div className="flex justify-between">
        <div className="flex justify-between rightDetails-top-buttons">
          <button className="mr-4">Deposit</button>
          <button className="mr-4">Borrow</button>
          <button className="mr-4">Withdraw</button>
          <button>Repay</button>
        </div>
        <div className="rightDetails-top-gear">
          <button>
            <SettingsIcon />
          </button>
        </div>
      </div>
      <hr className={styles['neptune-right-details__hr']} />
      <WalletDetails />
      <InputPicker pickerArray={null} placeholder={250} />
      <PercentButtons />
      <RangeBar setValue={() => {}} />
    </div>
  )
}

export default RightDetails