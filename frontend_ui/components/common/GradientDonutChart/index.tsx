import ReactApexChart from "react-apexcharts";

const GradientDonutChart = ({ series, options }: Props) => {
  return (
    <div id="chart">
      <ReactApexChart options={options} series={series} type="donut" />
    </div>
  )
}

type Props = {
  series: number[],
  options:{
    [key:string]: any
  }
}

export default GradientDonutChart

