<?php
if ( ! defined('ABSPATH')){
    exit; 
}
remove_action('woocommerce_sidebar','woocommerce_get_sidebar', 10);
remove_action('woocommerce_single_product_summary','woocommerce_template_single_excerpt', 20);