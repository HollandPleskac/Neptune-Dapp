import React from 'react';
import SolLogo from 'assets/SolLogo';
import styles from './donutGraph.module.scss';
import GradientDonutChart from 'components/common/GradientDonutChart';

const series = [3456069, 1456069];
const options = {
  chart: {
    width: 200,
    height: 200,
    type: 'donut',
    dropShadow: {
      enabled: true,
      top: 0,
      left: 0,
      blur: 3,
      color: ['#2D91EF', '#EF2D8A'],
      opacity: 0.5,
    },
  },
  dataLabels: {
    enabled: false,
  },
  fill: {
    type: 'solid',
  },
  // still playing with gradients - can be implemented later
  // fill: {
  //   type: 'gradient',
  //   gradient: {
  //     type: "vertical",
  //     shadeIntensity: 0,
  //     gradientToColors: undefined,
  //     colorStops: [
  //       [
  //         {
  //           offset: 0,
  //           color: '#2D91EF',
  //           opacity: 1
  //         },
  //         {
  //           offset: 100,
  //           color: '#3E54E8',
  //           opacity: 1
  //         },
  //       ],
  //       [
  //         {
  //           offset: 0,
  //           color: '#EF2D8A',
  //           opacity: 1
  //         },
  //         {
  //           offset: 100,
  //           color: '#E83E67',
  //           opacity: 1
  //         },
  //       ]
  //     ]
  //   }
  // },
  colors: ['#2D91EF', '#EF2D8A'],
  stroke: {
    show: false,
  },
  legend: {
    show: false,
    // formatter: function(val: string, opts: {[key:string]: any}) {
    //   return val + " - " + opts.w.globals.series[opts.seriesIndex]
    // }
  },
  // responsive: [{
  //   breakpoint: 480,
  //   options: {
  //     chart: {
  //       width: 200
  //     },
  //     legend: {
  //       position: 'bottom'
  //     }
  //   }
  // }]
};

const Graph = () => {
  return (
    <div>
      <SolLogo className={styles['neptune-donut-graph__sol-logo']} />
      <GradientDonutChart series={series} options={options} />
    </div>
  );
};

export default Graph;
