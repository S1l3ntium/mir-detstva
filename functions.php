<?php

add_action( 'wp_enqueue_scripts', 'style_theme' );
add_action('wp_footer', 'scripts_theme');
add_theme_support('woocommerce');

add_action( 'wp_enqueue_scripts', 'action_function_name_7714', 99 );
function action_function_name_7714(){
  wp_localize_script( 'jquery', 'mytheme', array( 
    'template_url' => get_template_directory_uri(), 
  ) );
}

function style_theme() {
	wp_enqueue_style('reset', get_template_directory_uri() . '/assets/css/reset.css');
  wp_enqueue_style( 'bundle', get_template_directory_uri() . '/assets/css/bundle.css' );
  wp_enqueue_style( 'magnific-popup', get_template_directory_uri() . '/assets/magnific-popup/magnific-popup.css' );
}

function scripts_theme() {
  wp_enqueue_script('bundle-js', get_template_directory_uri() . '/assets/js/bundle-js.js');
  wp_enqueue_script('magnific-popup', get_template_directory_uri() . '/assets/magnific-popup/magnific-popup.js');
}

function remove_menus(){
  remove_menu_page( 'edit-comments.php' );          //Комментарии
  remove_menu_page( 'edit.php' );                   // Записи
	remove_menu_page( 'font-awesome' );                   // FA
	
  }
  add_action( 'admin_menu', 'remove_menus' );

add_theme_support ('custom-logo');
add_theme_support('menus');

add_filter('woocommerce_add_to_cart_fragments', 'header_add_to_cart_fragment');
add_filter( 'woocommerce_cart_needs_payment', '__return_false' );

remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_price', 10 );
//remove count
add_filter('woocommerce_subcategory_count_html','remove_count');
function remove_count(){
    $html='';
    return $html;
}
//add custom func files
if ( class_exists( 'WooCommerce')){
  require get_template_directory() . '/inc/woocommerce.php';
  require get_template_directory() . '/woocommerce/includes/wc-functions.php';
  require get_template_directory() . '/woocommerce/includes/wc-functions-remove.php';
  require get_template_directory() . '/woocommerce/includes/wc-functions-single.php';
}
?>