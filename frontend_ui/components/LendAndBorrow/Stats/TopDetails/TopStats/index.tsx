import Image from 'next/image'
import SolLogo from './../../../../../public/sol.png'

const TopStats = () => {
  return (
    <div className="flex justify-between w-full">
      <div className="flex">
        <Image src={SolLogo} alt="solana" width={40} height={40} layout="fixed" />
        <div className="flex flex-col">
          <p>SOL</p>
          <p className="text-xs opacity-50 whitespace-nowrap">Price: $184.04</p>        
        </div>  
      </div>
      <div className="flex flex-col">
        <p className="text-xs opacity-50">Reserves Size</p>
        <p>$4,912,138</p>
      </div>
      <div className="flex flex-col">
        <p className="text-xs opacity-50">Utilization Rate</p>
        <p>29.64%</p>
      </div>
      <div className="flex flex-col">
        <p className="text-xs opacity-50">Used as Collateral</p>
        <p>Yes</p>
      </div>
      <div className="flex flex-col">
        <p className="text-xs opacity-50">Liquidation Penalty</p>
        <p>10%</p>
      </div>
    </div>  
  )
}

export default TopStats