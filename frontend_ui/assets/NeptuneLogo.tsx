type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='96'
    height='97'
    viewBox='0 0 96 97'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <g filter='url(#filter0_d_277_963)'>
      <circle cx='48' cy='43' r='32' fill='url(#paint0_linear_277_963)' />
    </g>
    <rect x='32' y='27' width='6' height='24' fill='white' />
    <rect x='58' y='27' width='6' height='24' fill='white' />
    <path d='M64 44.0001L32 28.0001V33.0001L64 50.0001V44.0001Z' fill='white' />
    <rect x='45' y='27' width='6' height='32' fill='white' />
    <defs>
      <filter
        id='filter0_d_277_963'
        x='0'
        y='0.333333'
        width='96'
        height='96'
        filterUnits='userSpaceOnUse'
        color-interpolation-filters='sRGB'
      >
        <feFlood flood-opacity='0' result='BackgroundImageFix' />
        <feColorMatrix
          in='SourceAlpha'
          type='matrix'
          values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0'
          result='hardAlpha'
        />
        <feOffset dy='5.33333' />
        <feGaussianBlur stdDeviation='8' />
        <feComposite in2='hardAlpha' operator='out' />
        <feColorMatrix
          type='matrix'
          values='0 0 0 0 0.188235 0 0 0 0 0.529412 0 0 0 0 0.933333 0 0 0 0.4 0'
        />
        <feBlend
          mode='normal'
          in2='BackgroundImageFix'
          result='effect1_dropShadow_277_963'
        />
        <feBlend
          mode='normal'
          in='SourceGraphic'
          in2='effect1_dropShadow_277_963'
          result='shape'
        />
      </filter>
      <linearGradient
        id='paint0_linear_277_963'
        x1='26.6667'
        y1='19.6667'
        x2='70'
        y2='66.3333'
        gradientUnits='userSpaceOnUse'
      >
        <stop stop-color='#2D91EF' />
        <stop offset='1' stop-color='#3E54E8' />
      </linearGradient>
    </defs>
  </svg>
);

export default SvgComponent;
