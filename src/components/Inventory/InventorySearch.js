import React, { Component, PropTypes } from 'react';

import styles from '../../styles/InventorySearch.css';
import withStyles from '../../decorators/withStyles';

@withStyles(styles)
export default class InventorySearch extends Component {
  static propTypes = {
    searchTerm: PropTypes.string.isRequired,
    onSearchChange: PropTypes.func.isRequired,
  }

  handleSearchChange = (event) => {
    this.props.onSearchChange(event.target.value);
  }

  render() {
    return (
      <div className="InventorySearch">
        <input type="text"
               value={this.props.searchTerm}
               onChange={this.handleSearchChange} />
      </div>
    );
  }
}
