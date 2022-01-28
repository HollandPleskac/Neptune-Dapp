import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import SolLogo from './../../../../../assets/SolLogo';
import styles from './donutGraph.module.scss';

ChartJS.register(ArcElement, Tooltip, Legend);

export const data = {
  labels: [],
  datasets: [
    {
      label: '',
      data: [12, 19],
      backgroundColor: [
        '#EF2D8A',
        '#2D91EF',
      ],
      borderColor: [
        '#EF2D8A',
        '#2D91EF',
      ],
      borderWidth: 1,
    },
  ],
};

const DonutGraph = () => {
  return (
    <div style={{width: '200px', position: 'relative'}}>
      <SolLogo className={styles['neptune-donut-graph__sol-logo']} />
      <Doughnut data={data} width={200} height={200} options={{maintainAspectRatio: false}} />
    </div>
  )
}

export default DonutGraph