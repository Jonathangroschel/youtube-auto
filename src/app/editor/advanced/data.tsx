import type {
  AssetFilter,
  TextPresetGroup,
  TextPresetTag,
  TextStylePreset,
} from "./types";

export const toolbarItems = [
  {
    id: "ai",
    label: "AI Tools",
    testId: "@editor/ai-tools",
    icon: (className: string) => (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#filter0_i_9578_4468)">
          <path
            d="M8 17.6C8 14.2397 8 12.5595 8.65396 11.2761C9.2292 10.1471 10.1471 9.2292 11.2761 8.65396C12.5595 8 14.2397 8 17.6 8H22.4C25.7603 8 27.4405 8 28.7239 8.65396C29.8529 9.2292 30.7708 10.1471 31.346 11.2761C32 12.5595 32 14.2397 32 17.6V22.4C32 25.7603 32 27.4405 31.346 28.7239C30.7708 29.8529 29.8529 30.7708 28.7239 31.346C27.4405 32 25.7603 32 22.4 32H17.6C14.2397 32 12.5595 32 11.2761 31.346C10.1471 30.7708 9.2292 29.8529 8.65396 28.7239C8 27.4405 8 25.7603 8 22.4V17.6Z"
            fill="currentColor"
          />
          <path
            d="M8 17.6C8 14.2397 8 12.5595 8.65396 11.2761C9.2292 10.1471 10.1471 9.2292 11.2761 8.65396C12.5595 8 14.2397 8 17.6 8H22.4C25.7603 8 27.4405 8 28.7239 8.65396C29.8529 9.2292 30.7708 10.1471 31.346 11.2761C32 12.5595 32 14.2397 32 17.6V22.4C32 25.7603 32 27.4405 31.346 28.7239C30.7708 29.8529 29.8529 30.7708 28.7239 31.346C27.4405 32 25.7603 32 22.4 32H17.6C14.2397 32 12.5595 32 11.2761 31.346C10.1471 30.7708 9.2292 29.8529 8.65396 28.7239C8 27.4405 8 25.7603 8 22.4V17.6Z"
            fill="currentColor"
          />
        </g>
        <path
          d="M27 19.9993C27.0016 20.2045 26.9392 20.405 26.8216 20.5731C26.8075 20.5932 26.7927 20.6127 26.7773 20.6315C26.5516 20.9079 26.1646 20.953 25.8125 21.0106C24.9426 21.153 23.2261 21.5305 22.3773 22.3794C21.5389 23.218 21.1606 24.9034 21.0143 25.7825C20.9524 26.1546 20.902 26.5673 20.6011 26.7948C20.5906 26.8028 20.5799 26.8105 20.569 26.8181C20.4014 26.9347 20.2021 26.9972 19.9979 26.9972C19.7937 26.9972 19.5944 26.9347 19.4267 26.8181C19.4159 26.8106 19.4053 26.8029 19.3948 26.795C19.0937 26.5675 19.0433 26.1545 18.9814 25.7822C18.8352 24.903 18.457 23.2174 17.6184 22.3788C16.7798 21.5402 15.0942 21.162 14.215 21.0158C13.8427 20.9539 13.4297 20.9035 13.2022 20.6024C13.1943 20.5919 13.1866 20.5813 13.1791 20.5705C13.0625 20.4028 13 20.2035 13 19.9993C13 19.7951 13.0625 19.5958 13.1791 19.4282C13.1866 19.4174 13.1943 19.4067 13.2022 19.3963C13.4297 19.0952 13.8427 19.0448 14.215 18.9829C15.0942 18.8367 16.7798 18.4585 17.6184 17.6199C18.457 16.7813 18.8352 15.0957 18.9814 14.2164C19.0433 13.8442 19.0937 13.4312 19.3948 13.2037C19.4053 13.1958 19.4159 13.1881 19.4267 13.1805C19.5944 13.064 19.7937 13.0015 19.9979 13.0015C20.2021 13.0015 20.4014 13.064 20.569 13.1805C20.5799 13.1881 20.5907 13.1959 20.6012 13.2039C20.902 13.4314 20.9525 13.844 21.0143 14.216C21.1606 15.0952 21.5391 16.7812 22.378 17.6199C23.2267 18.4684 24.9426 18.8457 25.8124 18.988C26.1646 19.0457 26.5516 19.0908 26.7774 19.3672C26.7928 19.3861 26.8075 19.4055 26.8216 19.4256C26.9392 19.5936 27.0016 19.7942 27 19.9993Z"
          fill="white"
        />
        <defs>
          <filter
            id="filter0_i_9578_4468"
            x="8"
            y="8"
            width="24"
            height="24"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0"
            />
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_9578_4468" />
          </filter>
          <linearGradient
            id="paint0_linear_9578_4468"
            x1="32"
            y1="6.84337"
            x2="-22.8133"
            y2="30.5853"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.339453" stopColor="#001BFF" />
            <stop offset="0.704477" stopColor="#9779FF" />
            <stop offset="1" stopColor="#E3CEFF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video",
    testId: "@editor/media",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g fillRule="evenodd" clipRule="evenodd" filter="url(#video_svg__a)">
          <path
            fill="currentColor"
            d="M9.601 0c-3.36 0-5.04 0-6.324.654A6 6 0 0 0 .654 3.276C0 4.56.001 6.24.001 9.601v4.8c0 3.36.001 5.04.655 6.323a6 6 0 0 0 2.622 2.622C4.562 24 6.242 24 9.602 24H14.4c3.36 0 5.04 0 6.324-.654a6 6 0 0 0 2.622-2.622C24 19.44 24 17.76 24 14.4V9.6c0-3.36 0-5.04-.654-6.324A6 6 0 0 0 20.725.654C19.44 0 17.76 0 14.4 0z"
          />
          <path
            fill="url(#video_svg__b)"
            fillOpacity="0.2"
            d="M9.601 0c-3.36 0-5.04 0-6.324.654A6 6 0 0 0 .654 3.276C0 4.56.001 6.24.001 9.601v4.8c0 3.36.001 5.04.655 6.323a6 6 0 0 0 2.622 2.622C4.562 24 6.242 24 9.602 24H14.4c3.36 0 5.04 0 6.324-.654a6 6 0 0 0 2.622-2.622C24 19.44 24 17.76 24 14.4V9.6c0-3.36 0-5.04-.654-6.324A6 6 0 0 0 20.725.654C19.44 0 17.76 0 14.4 0z"
          />
        </g>
        <g filter="url(#video_svg__c)">
          <path
            fill="#fff"
            d="M16 12.8c0 .44 0 .66.058.862.05.179.135.347.247.495.127.167.303.299.655.563l.48.36c.824.618 1.236.927 1.58.92a1 1 0 0 0 .767-.383C20 15.345 20 14.83 20 13.8v-3.6c0-1.03 0-1.545-.213-1.816A1 1 0 0 0 19.021 8c-.345-.007-.757.302-1.581.92l-.48.36c-.352.264-.528.396-.655.563a1.5 1.5 0 0 0-.247.495C16 10.54 16 10.76 16 11.2z"
          />
        </g>
        <g filter="url(#video_svg__d)">
          <path
            fill="#fff"
            d="M5 10.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C6.52 7 7.08 7 8.2 7h3.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C15 8.52 15 9.08 15 10.2v3.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C13.48 17 12.92 17 11.8 17H8.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C5 15.48 5 14.92 5 13.8z"
          />
        </g>
        <defs>
          <filter
            id="video_svg__a"
            width="24"
            height="24"
            x="0.001"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
            <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend in2="shape" result="effect1_innerShadow_22531_1628" />
          </filter>
          <filter
            id="video_svg__c"
            width="8"
            height="12"
            x="14"
            y="7"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend
              in2="BackgroundImageFix"
              mode="multiply"
              result="effect1_dropShadow_22531_1628"
            />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1628" result="shape" />
          </filter>
          <filter
            id="video_svg__d"
            width="14"
            height="14"
            x="3"
            y="6"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend
              in2="BackgroundImageFix"
              mode="multiply"
              result="effect1_dropShadow_22531_1628"
            />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1628" result="shape" />
          </filter>
          <linearGradient
            id="video_svg__b"
            x1="12"
            x2="12"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "audio",
    label: "Audio",
    testId: "@editor/audio",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#audio_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#audio_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#audio_svg__c)">
          <path
            fill="#fff"
            d="M13 16.507V8.893a1 1 0 0 1 .876-.992l2.248-.28A1 1 0 0 0 17 6.627V5.1a1 1 0 0 0-1.085-.996l-2.912.247a2 2 0 0 0-1.83 2.057l.24 7.456a3 3 0 1 0 1.586 2.724l.001-.073z"
          />
        </g>
        <defs>
          <filter
            id="audio_svg__a"
            width="24"
            height="24"
            x="0"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
            <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend in2="shape" result="effect1_innerShadow_22531_1167" />
          </filter>
          <filter
            id="audio_svg__c"
            width="14"
            height="19.411"
            x="5"
            y="3.1"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_22531_1167" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1167" result="shape" />
          </filter>
          <linearGradient
            id="audio_svg__b"
            x1="12"
            x2="12"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "image",
    label: "Image",
    testId: "@editor/image",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#images_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#images_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#images_svg__c)">
          <path fill="#fff" d="M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
        </g>
        <g filter="url(#images_svg__d)">
          <path
            fill="#fff"
            d="M8.543 19c-2.1 0-3.15 0-3.695-.432a2 2 0 0 1-.759-1.551c-.006-.696.639-1.524 1.928-3.182l1.089-1.4c.645-.83.968-1.244 1.36-1.393a1.5 1.5 0 0 1 1.068 0c.392.149.715.564 1.36 1.394l1.745 2.243c.26.334.39.5.52.607a1.5 1.5 0 0 0 1.861.031c.134-.102.27-.264.54-.589.262-.314.393-.472.524-.573a1.5 1.5 0 0 1 1.832 0c.13.101.266.264.537.588.682.819 1.023 1.228 1.142 1.534a2 2 0 0 1-1.227 2.619c-.31.104-.828.104-1.862.104z"
          />
        </g>
        <defs>
          <filter
            id="images_svg__a"
            width="24"
            height="24"
            x="0"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
            <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend in2="shape" result="effect1_innerShadow_22531_760" />
          </filter>
          <filter
            id="images_svg__c"
            width="9"
            height="9"
            x="12"
            y="4"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_760" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_760" result="shape" />
          </filter>
          <filter
            id="images_svg__d"
            width="19.641"
            height="12.057"
            x="2.089"
            y="9.943"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_760" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_760" result="shape" />
          </filter>
          <linearGradient
            id="images_svg__b"
            x1="12"
            x2="12"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "subtitles",
    label: "Subtitles",
    testId: "@editor/subtitles",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#subtitles_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#subtitles_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#subtitles_svg__c)">
          <rect width="16" height="3" x="4" y="17" fill="#fff" rx="1.5" />
        </g>
        <defs>
          <filter
            id="subtitles_svg__a"
            width="24"
            height="24"
            x="0"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
            <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend in2="shape" result="effect1_innerShadow_22531_369" />
          </filter>
          <filter
            id="subtitles_svg__c"
            width="20"
            height="7"
            x="2"
            y="16"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_369" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_369" result="shape" />
          </filter>
          <linearGradient
            id="subtitles_svg__b"
            x1="12"
            x2="12"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    testId: "@editor/text",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#text_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#text_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#text_svg__c)">
          <path
            fill="#fff"
            d="M6 7.5A1.5 1.5 0 0 0 7.5 9h3v7.5a1.5 1.5 0 0 0 3 0V9h3a1.5 1.5 0 0 0 0-3h-9A1.5 1.5 0 0 0 6 7.5"
          />
        </g>
        <defs>
          <filter
            id="text_svg__a"
            width="24"
            height="24"
            x="0"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
            <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend in2="shape" result="effect1_innerShadow_22531_113" />
          </filter>
          <filter
            id="text_svg__c"
            width="16"
            height="16"
            x="4"
            y="5"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_113" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_113" result="shape" />
          </filter>
          <linearGradient
            id="text_svg__b"
            x1="12"
            x2="12"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "elements",
    label: "Elements",
    testId: "@editor/elements",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#elements_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v3.424c0 1.467 0 2.2-.166 2.891a6 6 0 0 1-.718 1.735c-.371.605-.89 1.124-1.928 2.162l-1.376 1.376c-1.038 1.038-1.557 1.557-2.162 1.928a6 6 0 0 1-1.735.718c-.69.166-1.424.166-2.891.166H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#elements_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v3.424c0 1.467 0 2.2-.166 2.891a6 6 0 0 1-.718 1.735c-.371.605-.89 1.124-1.928 2.162l-1.376 1.376c-1.038 1.038-1.557 1.557-2.162 1.928a6 6 0 0 1-1.735.718c-.69.166-1.424.166-2.891.166H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#elements_svg__c)">
          <path
            fill="#fff"
            d="M18.365 14H15.92c-.672 0-1.008 0-1.265.13a1.2 1.2 0 0 0-.524.525C14 14.912 14 15.248 14 15.92v2.445c0 1.454 0 2.18.288 2.517a1.2 1.2 0 0 0 1.006.417c.441-.035.955-.549 1.984-1.577l2.444-2.444c1.028-1.028 1.542-1.542 1.577-1.984a1.2 1.2 0 0 0-.417-1.007C20.546 14 19.82 14 18.365 14"
          />
        </g>
        <defs>
          <filter
            id="elements_svg__a"
            width="24"
            height="24"
            x="0"
            y="0"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
            <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend in2="shape" result="effect1_innerShadow_22531_673" />
          </filter>
          <filter
            id="elements_svg__c"
            width="11.303"
            height="11.303"
            x="12"
            y="13"
            colorInterpolationFilters="sRGB"
            filterUnits="userSpaceOnUse"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              result="hardAlpha"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_673" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_673" result="shape" />
          </filter>
          <linearGradient
            id="elements_svg__b"
            x1="12"
            x2="12"
            y1="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    testId: "@editor/settings",
    icon: (className: string) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#filter0_i_23453_9291)">
          <path
            d="M0 9.6C0 6.23969 0 4.55953 0.653961 3.27606C1.2292 2.14708 2.14708 1.2292 3.27606 0.653961C4.55953 0 6.23969 0 9.6 0H14.4C17.7603 0 19.4405 0 20.7239 0.653961C21.8529 1.2292 22.7708 2.14708 23.346 3.27606C24 4.55953 24 6.23969 24 9.6V14.4C24 17.7603 24 19.4405 23.346 20.7239C22.7708 21.8529 21.8529 22.7708 20.7239 23.346C19.4405 24 17.7603 24 14.4 24H9.6C6.23969 24 4.55953 24 3.27606 23.346C2.14708 22.7708 1.2292 21.8529 0.653961 20.7239C0 19.4405 0 17.7603 0 14.4V9.6Z"
            fill="currentColor"
          />
          <path
            d="M0 9.6C0 6.23969 0 4.55953 0.653961 3.27606C1.2292 2.14708 2.14708 1.2292 3.27606 0.653961C4.55953 0 6.23969 0 9.6 0H14.4C17.7603 0 19.4405 0 20.7239 0.653961C21.8529 1.2292 22.7708 2.14708 23.346 3.27606C24 4.55953 24 6.23969 24 9.6V14.4C24 17.7603 24 19.4405 23.346 20.7239C22.7708 21.8529 21.8529 22.7708 20.7239 23.346C19.4405 24 17.7603 24 14.4 24H9.6C6.23969 24 4.55953 24 3.27606 23.346C2.14708 22.7708 1.2292 21.8529 0.653961 20.7239C0 19.4405 0 17.7603 0 14.4V9.6Z"
            fill="url(#paint0_linear_23453_9291)"
            fillOpacity="0.2"
          />
        </g>
        <g filter="url(#filter1_d_23453_9291)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M8.76684 6.16526C9.94469 5.52696 10.5336 5.20781 11.1597 5.0829C11.7137 4.97237 12.2863 4.97237 12.8403 5.0829C13.4664 5.20781 14.0553 5.52696 15.2332 6.16526L15.2332 6.16526L15.7668 6.45447C16.9447 7.09277 17.5336 7.41192 17.9619 7.85842C18.3409 8.25348 18.6272 8.71889 18.8022 9.22448C19 9.79589 19 10.4342 19 11.7108V12.2892C19 13.5658 19 14.2041 18.8022 14.7755C18.6272 15.2811 18.3409 15.7465 17.9619 16.1416C17.5336 16.5881 16.9447 16.9072 15.7668 17.5455L15.2332 17.8347L15.2331 17.8348C14.0553 18.473 13.4664 18.7922 12.8403 18.9171C12.2863 19.0276 11.7137 19.0276 11.1597 18.9171C10.5336 18.7922 9.9447 18.473 8.76686 17.8348L8.76684 17.8347L8.23316 17.5455C7.05531 16.9072 6.46638 16.5881 6.03807 16.1416C5.6591 15.7465 5.37282 15.2811 5.1978 14.7755C5 14.2041 5 13.5658 5 12.2892V11.7108C5 10.4342 5 9.79589 5.1978 9.22448C5.37282 8.71889 5.6591 8.25348 6.03807 7.85842C6.46638 7.41192 7.05531 7.09277 8.23316 6.45447L8.76684 6.16526ZM12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z"
            fill="white"
          />
        </g>
        <defs>
          <filter
            id="filter0_i_23453_9291"
            x="0"
            y="0"
            width="24"
            height="24"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_23453_9291" />
          </filter>
          <filter
            id="filter1_d_23453_9291"
            x="3"
            y="4"
            width="18"
            height="18"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_23453_9291" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_23453_9291" result="shape" />
          </filter>
          <linearGradient
            id="paint0_linear_23453_9291"
            x1="12"
            y1="0"
            x2="12"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

export const mediaFilters: AssetFilter[] = ["All", "Video", "Images", "Audio"];

export const stockVideos = [
  {
    id: "stock-1",
    title: "Morning skyline",
    duration: "0:08",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "stock-2",
    title: "City rush",
    duration: "0:12",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "stock-3",
    title: "Studio light",
    duration: "0:10",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "stock-4",
    title: "Abstract loop",
    duration: "0:07",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
  },
];

export const textPresetTags: TextPresetTag[] = ["All", "Simple", "Title"];

export const textPresetGroups: TextPresetGroup[] = [
  {
    id: "simple",
    label: "Simple",
    category: "Simple",
    presets: [
      {
        id: "simple-title",
        name: "Title",
        category: "Simple",
        preview: [{ text: "Title", size: 22, weight: 600, fontFamily: "Space Grotesk" }],
        editText: "Title",
        editFontSize: 48,
        editFontFamily: "Space Grotesk",
      },
      {
        id: "simple-basic",
        name: "Simple",
        category: "Simple",
        preview: [{ text: "Simple", size: 16, fontFamily: "Montserrat" }],
        editText: "Simple",
        editFontSize: 32,
        editFontFamily: "Montserrat",
      },
      {
        id: "simple-cursive",
        name: "Cursive",
        category: "Simple",
        preview: [{ text: "Cursive", size: 24, fontFamily: "Pacifico" }],
        editText: "Cursive",
        editFontSize: 40,
        editFontFamily: "Pacifico",
      },
      {
        id: "simple-serif",
        name: "Serif",
        category: "Simple",
        preview: [{ text: "Serif", size: 20, fontFamily: "Playfair Display" }],
        editText: "Serif",
        editFontSize: 36,
        editFontFamily: "Playfair Display",
      },
      {
        id: "simple-typewriter",
        name: "Typewriter",
        category: "Simple",
        preview: [
          {
            text: "Typewriter",
            size: 13,
            fontFamily: "Space Mono",
          },
        ],
        editText: "Typewriter",
        editFontSize: 28,
        editFontFamily: "Space Mono",
      },
      {
        id: "simple-bold",
        name: "Bold",
        category: "Simple",
        preview: [
          { text: "bold", size: 24, weight: 700, fontFamily: "Bebas Neue" },
        ],
        editText: "bold",
        editFontSize: 44,
        editFontFamily: "Bebas Neue",
      },
      {
        id: "simple-editorial",
        name: "Editorial",
        category: "Simple",
        preview: [
          { text: "Editorial", size: 22, weight: 600, fontFamily: "DM Serif Display" },
        ],
        editText: "Editorial",
        editFontSize: 40,
        editFontFamily: "DM Serif Display",
      },
      {
        id: "simple-elegant",
        name: "Elegant",
        category: "Simple",
        preview: [
          { text: "Elegant", size: 22, fontFamily: "Cormorant Garamond" },
        ],
        editText: "Elegant",
        editFontSize: 42,
        editFontFamily: "Cormorant Garamond",
      },
      {
        id: "simple-modern",
        name: "Modern",
        category: "Simple",
        preview: [
          { text: "Modern", size: 22, weight: 600, fontFamily: "Manrope" },
        ],
        editText: "Modern",
        editFontSize: 40,
        editFontFamily: "Manrope",
      },
      {
        id: "simple-signature",
        name: "Signature",
        category: "Simple",
        preview: [
          { text: "Signature", size: 22, fontFamily: "Great Vibes" },
        ],
        editText: "Signature",
        editFontSize: 46,
        editFontFamily: "Great Vibes",
      },
      {
        id: "simple-classic",
        name: "Classic",
        category: "Simple",
        preview: [
          { text: "Classic", size: 21, weight: 600, fontFamily: "Cinzel" },
        ],
        editText: "Classic",
        editFontSize: 38,
        editFontFamily: "Cinzel",
      },
      {
        id: "simple-industrial",
        name: "Industrial",
        category: "Simple",
        preview: [
          {
            text: "INDUSTRIAL",
            size: 20,
            weight: 600,
            className: "tracking-[0.12em]",
            fontFamily: "Oswald",
          },
        ],
        editText: "INDUSTRIAL",
        editFontSize: 36,
        editFontFamily: "Oswald",
      },
      {
        id: "simple-reliable",
        name: "Reliable",
        category: "Simple",
        preview: [
          {
            text: "RELIABLE",
            size: 20,
            weight: 600,
            className: "tracking-[0.08em]",
            fontFamily: "Rubik",
          },
        ],
        editText: "RELIABLE",
        editFontSize: 36,
        editFontFamily: "Rubik",
      },
      {
        id: "simple-mono",
        name: "Mono",
        category: "Simple",
        preview: [
          { text: "Mono", size: 18, fontFamily: "Fira Code" },
        ],
        editText: "Mono",
        editFontSize: 32,
        editFontFamily: "Fira Code",
      },
    ],
  },
  {
    id: "title",
    label: "Title",
    category: "Title",
    presets: [
      {
        id: "title-traditional",
        name: "Traditional",
        category: "Title",
        preview: [
          { text: "bold", size: 28, weight: 700, fontFamily: "Playfair Display" },
          { text: "Traditional", size: 12, className: "uppercase tracking-[0.14em]" },
        ],
        editText: "bold\nTraditional",
        editFontSize: 46,
        editFontFamily: "Playfair Display",
      },
      {
        id: "title-editorial",
        name: "Editorial",
        category: "Title",
        preview: [
          { text: "Editorial", size: 21, weight: 600, fontFamily: "Merriweather" },
          { text: "Classic", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Editorial\nClassic",
        editFontSize: 42,
        editFontFamily: "Merriweather",
      },
      {
        id: "title-modern",
        name: "Modern",
        category: "Title",
        preview: [
          { text: "Modern", size: 20, weight: 600, fontFamily: "Space Grotesk" },
          { text: "Bauhaus", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Modern\nBauhaus",
        editFontSize: 40,
        editFontFamily: "Space Grotesk",
      },
      {
        id: "title-elegant",
        name: "Elegant",
        category: "Title",
        preview: [
          { text: "Elegant", size: 20, weight: 500, fontFamily: "Lora" },
          { text: "Light", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Elegant\nLight",
        editFontSize: 40,
        editFontFamily: "Lora",
      },
      {
        id: "title-signature",
        name: "Signature",
        category: "Title",
        preview: [
          { text: "Signature", size: 18, fontFamily: "Pacifico" },
          { text: "INDUSTRIAL", size: 18, weight: 700, className: "tracking-[0.08em]" },
        ],
        editText: "Signature\nINDUSTRIAL",
        editFontSize: 38,
        editFontFamily: "Pacifico",
      },
      {
        id: "title-reliable",
        name: "Reliable",
        category: "Title",
        preview: [
          { text: "RELIABLE", size: 16, weight: 600, className: "tracking-[0.12em]", fontFamily: "Oswald" },
          {
            text: "Typewriter",
            size: 8,
            fontFamily: "Space Mono",
          },
        ],
        editText: "RELIABLE\nTypewriter",
        editFontSize: 34,
        editFontFamily: "Oswald",
      },
      {
        id: "title-classic",
        name: "Classic",
        category: "Title",
        preview: [
          { text: "Classic", size: 20, weight: 600, fontFamily: "Playfair Display" },
          { text: "EST. 1998", size: 10, className: "uppercase tracking-[0.2em]" },
        ],
        editText: "Classic\nEST. 1998",
        editFontSize: 40,
        editFontFamily: "Playfair Display",
      },
      {
        id: "title-bold",
        name: "Bold",
        category: "Title",
        preview: [
          { text: "BOLD", size: 24, weight: 700, className: "tracking-[0.12em]", fontFamily: "Bebas Neue" },
          { text: "Studio", size: 12, className: "uppercase tracking-[0.18em]" },
        ],
        editText: "BOLD\nStudio",
        editFontSize: 44,
        editFontFamily: "Bebas Neue",
      },
      {
        id: "title-cinema",
        name: "Cinema",
        category: "Title",
        preview: [
          { text: "Cinema", size: 20, weight: 600, fontFamily: "Cinzel" },
          { text: "Presents", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Cinema\nPresents",
        editFontSize: 40,
        editFontFamily: "Cinzel",
      },
      {
        id: "title-avant",
        name: "Avant",
        category: "Title",
        preview: [
          { text: "Avant", size: 20, weight: 600, fontFamily: "Space Grotesk" },
          { text: "Studio", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Avant\nStudio",
        editFontSize: 40,
        editFontFamily: "Space Grotesk",
      },
      {
        id: "title-serif",
        name: "Serif",
        category: "Title",
        preview: [
          { text: "Serif", size: 20, weight: 500, fontFamily: "DM Serif Display" },
          { text: "Archive", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Serif\nArchive",
        editFontSize: 40,
        editFontFamily: "DM Serif Display",
      },
      {
        id: "title-mono",
        name: "Mono",
        category: "Title",
        preview: [
          { text: "Mono", size: 18, fontFamily: "Space Mono" },
          { text: "Blueprint", size: 10, className: "uppercase tracking-[0.2em]" },
        ],
        editText: "Mono\nBlueprint",
        editFontSize: 36,
        editFontFamily: "Space Mono",
      },
    ],
  },
];

export const textStylePresets: TextStylePreset[] = [
  {
    id: "style-solid",
    name: "Solid",
    settings: {
      color: "#111111",
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowOpacity: 25,
      outlineEnabled: false,
      backgroundEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 28,
      bold: true,
    },
  },
  {
    id: "style-outline",
    name: "Outline",
    settings: {
      color: "#ffffff",
      outlineEnabled: true,
      outlineColor: "#111111",
      outlineWidth: 3,
      shadowEnabled: false,
      shadowColor: "#000000",
      shadowBlur: 0,
      shadowOpacity: 0,
      backgroundEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 28,
      bold: true,
    },
  },
  {
    id: "style-outline-soft",
    name: "Soft Outline",
    settings: {
      color: "#ffffff",
      outlineEnabled: true,
      outlineColor: "#5667F5",
      outlineWidth: 4,
      shadowEnabled: true,
      shadowColor: "#5667F5",
      shadowBlur: 20,
      shadowOpacity: 45,
      backgroundEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 28,
      bold: true,
    },
  },
  {
    id: "style-pill-soft",
    name: "Pill",
    settings: {
      color: "#111111",
      backgroundEnabled: true,
      backgroundColor: "#DDE1FD",
      backgroundStyle: "line-block-round",
      outlineEnabled: false,
      shadowEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 24,
      bold: true,
    },
  },
  {
    id: "style-pill-bold",
    name: "Bold Pill",
    settings: {
      color: "#ffffff",
      backgroundEnabled: true,
      backgroundColor: "#5667F5",
      backgroundStyle: "line-block-round",
      outlineEnabled: false,
      shadowEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 24,
      bold: true,
    },
  },
  {
    id: "style-pill-hard",
    name: "Hard Pill",
    settings: {
      color: "#ffffff",
      backgroundEnabled: true,
      backgroundColor: "#5667F5",
      backgroundStyle: "line-block-hard",
      outlineEnabled: false,
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 8,
      shadowOpacity: 20,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 24,
      bold: true,
    },
  },
  {
    id: "style-invert",
    name: "Invert",
    settings: {
      color: "#111111",
      outlineEnabled: true,
      outlineColor: "#ffffff",
      outlineWidth: 3,
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 12,
      shadowOpacity: 22,
      backgroundEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 28,
      bold: true,
    },
  },
  {
    id: "style-neon",
    name: "Neon",
    settings: {
      color: "#ffffff",
      outlineEnabled: true,
      outlineColor: "#5667F5",
      outlineWidth: 2,
      shadowEnabled: true,
      shadowColor: "#5667F5",
      shadowBlur: 18,
      shadowOpacity: 60,
      backgroundEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 28,
      bold: true,
    },
  },
  {
    id: "style-glow",
    name: "Glow",
    settings: {
      color: "#ffffff",
      outlineEnabled: true,
      outlineColor: "#5667F5",
      outlineWidth: 4,
      shadowEnabled: true,
      shadowColor: "#5667F5",
      shadowBlur: 14,
      shadowOpacity: 70,
      backgroundEnabled: false,
    },
    preview: {
      text: "Abc",
      fontFamily: "Roboto",
      fontSize: 28,
      bold: true,
    },
  },
];

export const textFontFamilies = [
  "Roboto",
  "Inter",
  "Space Grotesk",
  "Montserrat",
  "Poppins",
  "Manrope",
  "DM Sans",
  "Work Sans",
  "Raleway",
  "Nunito",
  "Rubik",
  "Barlow",
  "Fira Sans",
  "Cabin",
  "Archivo",
  "Anton",
  "Oswald",
  "Bebas Neue",
  "Playfair Display",
  "DM Serif Display",
  "Merriweather",
  "Lora",
  "Crimson Text",
  "Cormorant Garamond",
  "Cinzel",
  "Pacifico",
  "Lobster",
  "Great Vibes",
  "Space Mono",
  "Fira Code",
  "Inconsolata",
  "Georgia",
  "Times New Roman",
  "Courier New",
];

export const textFontSizes = [12, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64];
export const textLetterSpacingOptions = [0, 0.5, 1, 1.5, 2, 3];
export const textLineHeightOptions = [1, 1.1, 1.25, 1.4, 1.6];

export const backgroundSwatches = [
  "#0A0A0A",
  "#1F2937",
  "#111827",
  "#0F172A",
  "#F2F4FA",
  "#F8FAFC",
  "#FFFFFF",
];

export const noiseDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";
