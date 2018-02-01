pragma solidity ^0.4.18;

import "../common/SafeMathLib.sol";
import "../common/Manageable.sol";
import "./IProductStorage.sol";

/**@dev Contract that stores all products' data. Contains simple methods for retrieving and changing products */
contract ProductStorage is Manageable, IProductStorage {
    
    using SafeMathLib for uint256;

    //
    //Inner type

    //Purchase information
    struct Purchase {
        //who made a purchase
        address buyer; 
        //unit price at the moment of purchase
        uint256 price; 
        //how many units bought
        uint256 paidUnits;        
        //product-specific client id
        string clientId;         
    }

    /**@dev
    Storage data of product */
    struct ProductData {    
        //product's creator
        address owner;
        //wallet to receive payments
        address wallet;
        //price of one product unit in WEI
        uint256 price;
        //max quantity of limited product units, or 0 if unlimited
        uint256 maxUnits;
        //true if it is possible to buy a product
        bool isActive;
        //how many units already sold
        uint256 soldUnits;
        //timestamp of the purchases start
        uint256 startTime;
        //timestamp of the purchases end
        uint256 endTime;
        //custom FeePolicy contract for the product, or 0 if default is used
        address feePolicy;
        //number of purchases made so far
        uint256 purchases;
        //name of the product 
        string name; 
        string data;
        //array of purchase information
        //Purchase[] purchases;        
    }    



    //
    //Events
    event ProductAdded(
        address indexed owner, 
        address indexed wallet, 
        uint256 price, 
        uint256 maxUnits,         
        uint256 startTime, 
        uint256 endTime, 
        address feePolicy,        
        string name,
        string data
    );

    event PurchaseAdded(
        uint256 indexed productId,
        uint256 indexed id,
        address indexed buyer,    
        uint256 price,         
        uint256 paidUnits,        
        string clientId  
    );

    event ProductEdited(
        uint256 indexed productId,        
        address wallet, 
        uint256 price, 
        uint256 maxUnits, 
        bool isActive,
        uint256 soldUnits,      
        uint256 startTime, 
        uint256 endTime,         
        string name,
        string data
    );

    event CustomParamsSet(
        uint256 indexed productId,
        address feePolicy        
    );



    //
    //Storage data    

    //List of all created products
    ProductData[] public products;
    //true if [x] product is not allowed to be purchase
    mapping(uint256=>bool) public banned;
    

    //
    //Modifiers
    modifier validProductId(uint256 productId) {
        require(productId < products.length);
        _;
    }

    // modifier validPurchaseId(uint256 productId, uint256 purchaseId) {
    //     require(purchaseId < products[productId].purchases);
    //     _;
    // }
    
    
    //
    //Methods

    function ProductStorage() public {        
    }

    /**@dev Returns total amount of products */
    function getTotalProducts() public constant returns(uint256) {
        return products.length;
    }

    /**@dev Returns text information about product */
    function getTextData(uint256 productId) 
        public
        constant
        returns(            
            string name, 
            string data
        ) 
    {
        ProductData storage p = products[productId];
        return (            
            p.name, 
            p.data
        );
    }

    /**@dev Returns information about product */
    function getProductData(uint256 productId) 
        public
        constant
        returns(            
            uint256 price, 
            uint256 maxUnits, 
            uint256 soldUnits
        ) 
    {
        ProductData storage p = products[productId];
        return (            
            p.price, 
            p.maxUnits, 
            p.soldUnits
        );
    }

    /**@dev Returns information about product's active state and time limits */
    function getProductActivityData(uint256 productId) 
        public
        constant
        returns(            
            bool active, 
            uint256 startTime, 
            uint256 endTime
        ) 
    {
        ProductData storage p = products[productId];
        return (            
            p.isActive, 
            p.startTime, 
            p.endTime
        );
    }

    function getProductPaymentData(uint256 productId) 
        public
        constant        
        returns(
            address wallet,
            address feePolicy
        )
    {
        ProductData storage p = products[productId];
        return (
            p.wallet,
            p.feePolicy
        );
    }

    /**@dev Returns product's creator */
    function getProductOwner(uint256 productId) 
        public 
        constant         
        returns(address)
    {
        return products[productId].owner;
    }   

    /**@dev Returns product's creator */
    function getProductPrice(uint256 productId) 
        public 
        constant         
        returns(uint256)
    {
        return products[productId].price;
    }   

    /**@dev Returns true if product can be bought now */
    function isProductActive(uint256 productId) 
        public 
        constant         
        returns(bool)
    {
        return products[productId].isActive && 
            (products[productId].startTime == 0 || now >= products[productId].startTime) &&
            (products[productId].endTime == 0 || now <= products[productId].endTime);
    }   

    /**@dev Returns total amount of purchase transactions for the given product */
    function getTotalPurchases(uint256 productId) 
        public 
        constant
        returns (uint256) 
    {
        return products[productId].purchases;        
    }

    /**@dev Returns information about purchase with given index for the given product */
    // function getPurchase(uint256 productId, uint256 purchaseId) 
    //     public
    //     constant         
    //     returns(address buyer, string clientId, uint256 price, uint256 paidUnits) 
    // {
    //     Purchase storage p = products[productId].purchases[purchaseId];
    //     return (            
    //         p.buyer,
    //         p.clientId,
    //         p.price,   
    //         p.paidUnits
    //     );
    // }

    /**@dev Adds new product to the storage */
    function createProduct(
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
        managerOnly
    {
        ProductData storage product = products[products.length++];
        product.owner = owner;
        product.wallet = wallet;
        product.price = price;
        product.maxUnits = maxUnits;
        product.startTime = startTime;
        product.endTime = endTime;
        product.isActive = true;
        product.feePolicy = feePolicy;
        product.name = name;
        product.data = data;
        ProductAdded(owner, wallet, price, maxUnits, startTime, endTime, feePolicy, name, data);
    }


    /**@dev Edits product in the storage */   
    function editProduct(
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
        validProductId(productId)
        managerOnly
    {
        ProductData storage product = products[productId];
        product.wallet = wallet;
        product.price = price;
        product.maxUnits = maxUnits;
        product.startTime = startTime;
        product.endTime = endTime;
        product.soldUnits = soldUnits;
        product.isActive = isActive;
        product.name = name;
        product.data = data;
        ProductEdited(productId, wallet, price, maxUnits, isActive, soldUnits, startTime, endTime, name, data);
    }

    /**@dev Sets "handlers" parameters */
    function setCustomParams(uint256 productId, address feePolicy) 
        public 
        managerOnly
        validProductId(productId)
    {
        ProductData storage product = products[productId];
        product.feePolicy = feePolicy;

        CustomParamsSet(productId, feePolicy);
    }

    /**@dev  Adds new purchase to the list of given product */
    function addPurchase(
        uint256 productId,        
        address buyer,    
        uint256 price,         
        uint256 paidUnits,        
        string clientId   
    ) 
        public 
        managerOnly
        validProductId(productId)
    {
        //Purchase storage purchase = products[productId].purchases[products[productId].purchases.length++];
        // purchase.buyer = buyer;
        // purchase.price = price;
        // purchase.paidUnits = paidUnits;
        // purchase.clientId = clientId;    
        PurchaseAdded(product.purchases, productId, buyer, price, paidUnits, clientId);
        
        ProductData storage product = products[productId];
        product.soldUnits = product.soldUnits.safeAdd(paidUnits);
        product.purchases = product.purchases.safeAdd(1);            
    }

    /**@dev marks product as banned. other contracts shoudl take this into account when interacting with product */
    function banProduct(uint256 productId, bool state) 
        public 
        managerOnly
        validProductId(productId)
    {
        banned[productId] = state;
    }
}