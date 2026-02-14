
import { Venue, Product, MatchFeedItem } from './types';

export const VENUES: Venue[] = [
  {
    id: 'v1',
    name: 'Super Strikers Arena',
    location: 'Anna Nagar',
    distance: '2.5 km',
    rating: 4.8,
    reviews: 120,
    price: 800,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAI5XwTeEMrwqVWTZH5TQhLXe-G5LbNGFiN5rgP7Cq0FlSJHsaX_iBlIm6WQqDH9eHvWy_gBIw20NA0HCThQu-UPq9SmJ3JI6XTPxhx8Ii_tDAjmIwiPPun5HeONYoOFM4U7-CAlE5a_kt2d-65bdWa6j7E6zgZ9w2Z2AZBzOLL6DKbSumow-CTR4-kW6ADG-ofCBHCgSwnNiyK5sEWArH1od8b5jpGWV1BdO90WKOlSrBR5UTDqxvZIBWyr6dbChjhTb6iNlhNC3MO',
    categories: ['Cricket', 'Football'],
    tags: ['Popular', 'Fast Filling'],
    amenities: ['Parking', 'Water', 'Floodlights']
  },
  {
    id: 'v2',
    name: 'Blue Court Badminton',
    location: 'T. Nagar',
    distance: '4.1 km',
    rating: 4.5,
    reviews: 85,
    price: 400,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeeuRxFPn45td3yDjrmCwmVTNz0sf1GkNve1GZssQwaD6LMrZXjEuCp17f5KG90kK25ycSDzyCbj5zCRRhYlyKUXLoThu5NBkwwNJS2jbUBtwOGzuTU0J9RTa_n125_SoZnQyK2zPnKZlJNkGM9C4RWGQm39tTje9LRetSfZ-iPWXLyNMG6DHVf0yjkmiM2kJGFM_gJ_ZpJGwI_yvL6V4KLLI4MFP6fDrB_EkXORuvtWcNm5NaHZzgVlUALEjvEgBcyamtbDNqPIXG',
    categories: ['Badminton'],
    amenities: ['Changing Room', 'Water']
  },
  {
    id: 'v3',
    name: 'Marina Turf',
    location: 'Marina Beach',
    distance: '1.2 km',
    rating: 4.2,
    reviews: 42,
    price: 1200,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDERO84KpqXSBxMLfGLtSVQQxcGnrjBKqHH3yMbgkW1wLtr-JvDCcHd4cvqW2EoEvbCqsnQTFulyhd3RFvj4DL_dwftG8HjevcBFwu4BX1RUDukN7XuB3tropb2PkVyx4bpIr2XCb2pRDrSntalFgf1uidMvIMTadK2XL7Brsv1aDyRk3kQ5neb2wBMy-OWwCKFfyWNaPOsWhxB8-zgJe1XQvbLpjlqxV9Mdk36U664wNFry6ug7cK3p3Ewdsa8__GrELKPjIGdW_zm',
    categories: ['Football', 'Cricket'],
    tags: ['Premium'],
    amenities: ['Parking', 'Floodlights', 'Changing Room']
  }
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'SG Test White Cricket Ball',
    brand: 'SG',
    price: 650,
    originalPrice: 850,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuABeOyIPKgxa2g-HGDyw2K87m_ES57UaR0Jp8eefiRC5KWDEO8d7TNxDfke0P8wyfdcHxjDvXOpjhZ8papZlpOq_jU26uMoBjxu_Vj8h600B0Zoj91BdDwQqM86ATLzTukH9p6f3FLwnW26BpQDHwC7Hb3x7j3eb24i1bXThUe4kDRTGrkZ8qXQ9qz4yUKZw9TnLCAMMU9xVR2cB1a7QobhzuWUPTEye8-pPKV0KlBepuy5y2DIoR66FJB3QQHMW9z6cn7j8XbTWgw1'
  },
  {
    id: 'p2',
    name: 'Nivia Pro Carbon Football Shoes',
    brand: 'Nivia',
    price: 1199,
    originalPrice: 1499,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDwlYnRPH5Ggq0vUew4QbNwAkjHy6T2cXh1s9JOD9P6PYzNdnYvlDNAYGivyanj3kLWVMoriztcvrXyDDEYrdyMaSr0YTakvGQ1rb7nv3_db4PGb3TaBI-RnPvzyGg-iq8hzHZO3Fw9-UwR6bbCzQM-8HqYZJfCjHOwd1ibC3hNZxcC9ENDM6xKSeVRJ_RW6xjA3a2Wq14eRPzXiQvjEqX9mYFm6ARFkWHkUCKkuold9VLUvbdD0vY7kA736wnR6FJIQsk5-E77YrGy',
    tag: 'Sale'
  },
  {
    id: 'p3',
    name: 'Yonex Muscle Power 29 Lite',
    brand: 'Yonex',
    price: 2150,
    originalPrice: 2890,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARZpewCHAOQUeNIrh8xiNDGGMGA5vuIMjPbiIBqr0S8qoMegB7-B6rmjy44Ok4KKDalW-o6MDFRzW_foMVvMqsXn2xW21oL4ejfDNpJn-arR0sEIBbwYIX-N5ksHZhhg6PWdI2nsRhNFu0nRnjS0P5g3N-7He9uDB1qGmY6HFWL9rl4MkiOqPTGmBqz1z3UUtSnHaf0OETTnW_7Kd-3n0xuic6-FbQ6PxiRLYtTLLrk1Ny_hRaD48cfMXxn2DgskSkcdp8kw_8JTTk'
  }
];

export const FEED_ITEMS: MatchFeedItem[] = [
  {
    id: 'f1',
    type: 'live',
    title: 'Saturday Night League',
    time: 'Live • Just now',
    teamA: { name: 'Super Strikers', icon: '⚽', logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD_-_xjU6SfmsM5g3r1KD5YVsFPfOn7xtoobBGOLZY5GmyP_4aupPMV4H-1WO1eLhW7FJyfAfuITUpOesMlgMqq_DI7PuqKUXW-i9BCgqd-PRUs1kE80NtR1nHYyoSLBTcpfuypMf8SEFpV0envOS5i8nNfLgYVpBLiapWB6-3fmpxxquk_D8VnxI7dbd24ZXQqiO-TpM50ZjiThNLNneTK2Y_aU6vyQWfb8IcxQPwOTtmh1SoGgV782NaUMb5u6iaJi7MmrvgBMnN4' },
    teamB: { name: 'Red Dragons', icon: '⚽', logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCqJfjvntmLBSp2lryKlyfm_vhXNDCQeXFjOIWuj-RuWtctHSRlu2o_QyBJXrUyT6-7ollnLWrvaoGnaNiEcEQPrcy-alNPhKi1JujQ-F-64nwXv6ZyleN2bDwzcq_1aHEO6sWdhoHvC_-en4IoCpkpJa8VBt7QJDrrt1FWeI4Rg_8CWD1kntOHrHtwi7FgHTlbn2hV4m67rlfEM1bWSYgqNG6e-Dw0_ohZV1JEYy2x1wjalATla1WSXjC2JsVQecVG4mj9UuEQLFaO' },
    description: 'Finals match underway! The energy is electric tonight on the main turf. ⚡️',
    likes: 124,
    comments: 12
  },
  {
    id: 'f2',
    type: 'result',
    title: 'Arjun K.',
    time: 'Result • 2 hours ago',
    teamA: { name: 'Lions FC', icon: '🦁', score: 5 },
    teamB: { name: 'Eagles', icon: '🦅', score: 3 },
    description: 'What a comeback by the Lions! Unbelievable performance in the second half. 🏆',
    likes: 342,
    comments: 56
  }
];
