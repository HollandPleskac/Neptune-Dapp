import ReactApexChart from 'react-apexcharts';

const LineChart = ({ lineChartOptions, lineChartData }: Props) => {
  return (
    <>
      {typeof window !== 'undefined' && (
        <ReactApexChart
          options={lineChartOptions}
          series={lineChartData}
          type="area"
          width="100%"
          height="100%"
        />
      )}
    </>
  );
};

type Props = {
  lineChartOptions: {
    [key: string]: any;
  };
  lineChartData: {
    [key: string]: any;
  }[];
};

export default LineChart;
