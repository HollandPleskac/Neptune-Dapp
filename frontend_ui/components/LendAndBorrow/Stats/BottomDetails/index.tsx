import cx from 'classnames';
import { useState } from 'react';
import Button from 'components/common/Button';
import LineChart from 'components/common/LineChart';

const lineChartDataDashboard = [
  {
    name: 'Deposit APY',
    data: [100, 200, 150, 160, 180, 200, 210],
  },
  {
    name: 'Borrow APY',
    data: [100, 50, 80, 60, 40, 30, 10],
  },
];

const lineChartOptionsDashboard = {
  chart: {
    toolbar: {
      show: false,
    },
  },
  tooltip: {
    theme: 'dark',
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: 'smooth',
  },
  xaxis: {
    categories: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    labels: {
      style: {
        colors: '#c8cfca',
        fontSize: '12px',
      },
    },
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: '#c8cfca',
        fontSize: '12px',
      },
    },
  },
  legend: {
    show: false,
  },
  grid: {
    strokeDashArray: 5,
    borderColor: '#56577A',
  },
  // fill: {
  //   type: "gradient",
  //   // gradient: {
  //   //   shade: "dark",
  //   //   type: "vertical",
  //   //   shadeIntensity: 0,
  //   //   gradientToColors: undefined, // optional, if not defined - uses the shades of same color in series
  //   //   inverseColors: true,
  //   //   opacityFrom: 0.8,
  //   //   opacityTo: 0,
  //   //   stops: [],
  //   // },
  //   colors: ["#25B38F", "#ED6564"],
  // },
  colors: ['#25B38F', '#ED6564'],
};

const BottomDetails = () => {
  const [historyButtons, setHistoryButtons] = useState([
    {
      text: '1D',
      active: false,
    },
    {
      text: '7D',
      active: false,
    },
    {
      text: '1M',
      active: true,
    },
    {
      text: '3M',
      active: false,
    },
    {
      text: '6M',
      active: false,
    },
    {
      text: '1Y',
      active: false,
    },
  ]);

  const handleClickHistoryButton = (activeButton: {
    text: string;
    active: boolean;
  }) => {
    const newButtons = historyButtons.map((hb) => {
      if (hb.text === activeButton.text) {
        return {
          ...hb,
          active: true,
        };
      }
      return {
        ...hb,
        active: false,
      };
    });
    setHistoryButtons(newButtons);
  };

  return (
    <>
      <div className="flex justify-between w-full">
        <span>Historical APY</span>
        <div className="flex bg-gray-light rounded p-2px">
          {historyButtons.map((hb, i) => (
            <Button
              key={i}
              text={hb.text}
              onClick={() => handleClickHistoryButton(hb)}
              className={cx({
                'neptune-button__bg-gray-light-small': !hb.active,
                'neptune-button__bg-gray-light-small-active': hb.active,
              })}
            />
          ))}
        </div>
      </div>
      <LineChart
        lineChartData={lineChartDataDashboard}
        lineChartOptions={lineChartOptionsDashboard}
      />
      <div className="flex justify-between w-full">
        <div className="flex">
          <span className="mr-4">Deposit APY</span>
          <span>Borrow APY</span>
        </div>
        <div>Rewards APR Details</div>
      </div>
    </>
  );
};

export default BottomDetails;
