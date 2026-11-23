/**
 * High-Performance Indian Currency Number-to-Words Converter
 * Supports values up to hundreds and thousands of crores.
 * Employs in-memory caching to eliminate repetitive string parsing and mathematical calculations.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function twoDigitsToWords(n) {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return TENS[tens] + (units ? ' ' + ONES[units] : '');
}

function threeDigitsToWords(n) {
  let str = '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    str += ONES[hundreds] + ' Hundred';
    if (remainder > 0) str += ' and ';
  }
  if (remainder > 0) {
    str += twoDigitsToWords(remainder);
  }
  return str;
}

function convertLakhsAndThousands(n) {
  let str = '';
  const lakhs = Math.floor(n / 100000);
  let rem = n % 100000;

  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (lakhs > 0) {
    str += twoDigitsToWords(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    str += twoDigitsToWords(thousands) + ' Thousand ';
  }
  if (rem > 0) {
    str += threeDigitsToWords(rem) + ' ';
  }
  return str.trim();
}

const wordsCache = new Map();
const MAX_CACHE_SIZE = 250;

export function numberToIndianWords(num) {
  if (num === null || num === undefined || isNaN(num)) return '';

  const rounded = Math.round(Number(num) * 100) / 100;
  if (rounded === 0) return 'Rupees Zero Only';

  const cached = wordsCache.get(rounded);
  if (cached !== undefined) {
    return cached;
  }

  const parts = rounded.toFixed(2).split('.');
  const intPart = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);

  let words = '';

  const crores = Math.floor(intPart / 10000000);
  const remainder = intPart % 10000000;

  if (crores > 0) {
    if (crores >= 100) {
      words += convertLakhsAndThousands(crores) + ' Crore ';
    } else {
      words += twoDigitsToWords(crores) + ' Crore ';
    }
  }

  if (remainder > 0) {
    words += convertLakhsAndThousands(remainder) + ' ';
  }

  words = words.trim();
  let result = 'Rupees ' + words;

  if (paise > 0) {
    result += ' and ' + twoDigitsToWords(paise) + ' Paise';
  }

  result += ' Only';

  if (wordsCache.size >= MAX_CACHE_SIZE) {
    wordsCache.clear();
  }
  wordsCache.set(rounded, result);

  return result;
}
