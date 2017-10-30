pragma solidity ^0.4.10;

import './Vendor.sol';
import './Product.sol';
import './IVendor.sol';
import './IVendorManager.sol';
import '../common/Owned.sol';

/**@dev Factory to create and vendors and products */
contract VendorFactory is Owned, Versioned {

    event VendorCreated(address indexed vendorOwner, address indexed vendor, string name, uint256 fee);
    event ProductCreated(address indexed product, address indexed vendor, string name);

    IVendorManager public manager;

    function VendorFactory(IVendorManager _manager) public {
        manager = _manager;
        version = 1;
    }

    // allows execution only if this factory is set in manager
    modifier activeOnly {
        //require(manager.factory() == address(this));
        require(manager.validFactory(this) && manager.active());
        _;
    }


}