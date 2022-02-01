import React from 'react';
import SolLogo from '../../../../../assets/SolLogo';
import styles from './donutGraph.module.scss';
import GradientDonutChart from '../../../../common/GradientDonutChart'

const series = [3456069, 1456069];
const options =  {
  chart: {
    width: 200,
    height: 200,
    type: 'donut',
  },
  dataLabels: {
    enabled: false
  },
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'dark',
    }
  },
  colors:['#2D91EF', '#EF2D8A'],
  stroke: {
    show: false
  },
  legend: {
    show: false
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
}

const Graph = () => {
  return (
    <div>
      <SolLogo className={styles['neptune-donut-graph__sol-logo']} />
      <GradientDonutChart series={series} options={options} />
    </div>
  )
}

export default Graph