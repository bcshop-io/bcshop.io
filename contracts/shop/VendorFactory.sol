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

    /**@dev Creates vendor with specified wallet to receive profit*/
    function createVendor(address vendorWallet, string name)
        public
        activeOnly 
        returns (address)
    {
        Vendor vendor = new Vendor(manager, name, vendorWallet, manager.provider(), manager.providerFeePromille());
        vendor.transferOwnership(msg.sender);
        manager.addVendor(msg.sender, vendor);

        VendorCreated(msg.sender, vendor, name, manager.providerFeePromille());
        return vendor;
    }

    /**@dev Creates vendor with given fee, only owner is allowed to call it */
    function createCustomVendor(address vendorOwner, address vendorWallet, string name, uint256 feeInPromille) 
        public
        activeOnly
        returns (address)
    {
        Vendor vendor = new Vendor(manager, name, vendorWallet, manager.provider(), feeInPromille);
        vendor.transferOwnership(vendorOwner);
        manager.addVendor(vendorOwner, vendor);

        VendorCreated(vendorOwner, vendor, name, feeInPromille);
        return vendor;
    }

    /**@dev Creates product with specified parameters */
    function createProduct(
        IVendor vendor,
        string name, 
        uint256 unitPriceInWei,
        uint32 maxQuantity 
        // bool allowFractions,
        // uint256 purchaseStartTime,
        // uint256 purchaseEndTime
    )
        public      
        activeOnly 
        returns (address) 
    {
        //check that sender is owner of given vendor
        require(msg.sender == vendor.owner());

        //check that vendor is stored in manager
        require(manager.validVendor(vendor));        

        Product product = new Product(
            //vendor.getProductsCount(), 
            name, 
            unitPriceInWei, 
            maxQuantity
            /*allowFractions, 
            purchaseStartTime, 
            purchaseEndTime*/);            

        product.transferOwnership(address(vendor));
        vendor.addProduct(address(product));

        ProductCreated(product, vendor, name);        
        return product;
    }
}