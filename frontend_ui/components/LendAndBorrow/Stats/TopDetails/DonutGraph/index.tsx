import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

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
    <div style={{width: '200px'}}>
      <Doughnut data={data} width={200} height={200} options={{maintainAspectRatio: false}} />
    </div>
  )
}

export default DonutGraph