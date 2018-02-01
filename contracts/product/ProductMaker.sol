pragma solidity ^0.4.18;

import "../common/Owned.sol";
import "./ProductStorage.sol";

contract ProductMaker is Owned {

    //
    // Events
    event ProductCreated
    (
        address indexed owner,
        address indexed wallet,
        uint256 price,
        uint256 maxUnits,        
        uint256 startTime, 
        uint256 endTime, 
        address feePolicy,        
        string name
    );



    //
    // Storage data
    IProductStorage productStorage;    


    //
    // Methods

    function ProductMaker(IProductStorage _productStorage) public {
        productStorage = _productStorage;
    }

    function createSimpleProduct(
        address wallet, 
        uint256 price, 
        uint256 maxUnits,         
        uint256 startTime, 
        uint256 endTime,
        string name,
        string data
    ) 
        public
    {
        productStorage.createProduct(msg.sender, wallet, price, maxUnits, startTime, endTime, 0, name, data);
        
        ProductCreated(msg.sender, wallet, price, maxUnits, startTime, endTime, 0, name);
    }

    /**@dev Creates product with non-default feePolicy and/or purchaseHandler */
    function createSpecialProduct(
        address owner, 
        address wallet, 
        uint256 price, 
        uint256 maxUnits,         
        uint256 startTime, 
        uint256 endTime,
        address feePolicy,
        string name,
        string data
    ) 
        public
        ownerOnly
    {
        productStorage.createProduct(
            owner, 
            wallet, 
            price, 
            maxUnits,
            startTime, 
            endTime, 
            feePolicy, 
            name,
            data);
        
        ProductCreated(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name);
    }

    /**@dev Edits product in the storage */   
    function editSimpleProduct(
        uint256 productId,
        address wallet, 
        uint256 price, 
        uint256 maxUnits, 
        bool isActive,
        uint256 soldUnits,
        uint256 startTime, 
        uint256 endTime,        
        string name,
        string data
    ) 
        public    
    {
        require(msg.sender == productStorage.getProductOwner(productId));
        productStorage.editProduct(productId, wallet, price, maxUnits, isActive, soldUnits, startTime, endTime, name, data);        
    }

    function setCustomParams(uint256 productId, address feePolicy) 
        public
        ownerOnly 
    {
        productStorage.setCustomParams(productId, feePolicy);
    }
}