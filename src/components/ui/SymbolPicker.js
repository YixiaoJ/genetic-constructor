import React, { PropTypes } from 'react';
import symbols from '../../inventory/sbol';

import '../../styles/Picker.css';
import '../../styles/SymbolPicker.css';

export const SymbolPicker = ({current, readOnly, onSelect}) => {
  return (
    <div className={'Picker SymbolPicker' + (!!readOnly ? ' readOnly' : '')}>
      <div className="Picker-content">
        {symbols.map(symbolObj => {
          const symbol = symbolObj.id;
          return (<a className={'Picker-item' + (current === symbol ? ' active' : '')}
                     alt={symbolObj.name}
                     title={symbolObj.name}
                     key={symbol}
                     onClick={() => !readOnly && onSelect(symbol)}
                     style={{backgroundImage: `url(${symbolObj.images.thin})`}}/>);
        })}
        <a className={'Picker-item' + (!current ? ' active' : '')}
           style={{backgroundImage: `url(/images/sbolSymbols/thin/no_symbol.svg)`}}
           onClick={() => !readOnly && onSelect(null)}/>
      </div>
    </div>
  );
};

SymbolPicker.propTypes = {
  readOnly: PropTypes.bool,
  current: PropTypes.string,
  onSelect: PropTypes.func,
};

export default SymbolPicker;
