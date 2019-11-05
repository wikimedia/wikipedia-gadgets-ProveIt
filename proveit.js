/**
 * ProveIt is a smart and simple reference manager for Wikipedia (and any other MediaWiki wiki)
 * Documentation at https://commons.wikimedia.org/wiki/Help:Gadget-ProveIt
 *
 * Copyright 2008-2011 Georgia Tech Research Corporation, Atlanta, GA 30332-0415, ALL RIGHTS RESERVED
 * Copyright 2011- Matthew Flaschen
 * Rewritten, internationalized, improved and maintained by Sophivorus since 2014
 *
 * ProveIt is available under the GNU Free Documentation License (http://www.gnu.org/copyleft/fdl.html),
 * the Creative Commons Attribution/Share-Alike License 3.0 (http://creativecommons.org/licenses/by-sa/3.0/)
 * and the GNU General Public License 2 (http://www.gnu.org/licenses/gpl-2.0.html)
 */
window.ProveIt = {

	/**
	 * Template data of the templates
	 * Populated on ProveIt.init()
	 *
	 * @type {Object} Map from template name to template data
	 */
	templateData: {},

	/**
	 * Convenience method to get a ProveIt configuration option
	 * Configuration options are set from the loader of the wiki, not here
	 *
	 * @param {string} key Option key without the "proveit-" prefix
	 * @return {string} Option value
	 */
	getOption: function ( key ) {
		return mw.config.get( 'proveit-' + key );
	},

	/**
	 * Convenience method to get a ProveIt interface message
	 * Interface messages are set on ProveIt.init()
	 *
	 * @param {string} key Message key without the "proveit-" prefix
	 * @return {string} Message value
	 */
	getMessage: function ( key ) {
		return mw.message( 'proveit-' + key );
	},

	/**
	 * Convenience method to detect the current editor
	 *
	 * @return {string|null} Name of the current editor ('core', 'wikieditor', 'codemirror' or '2017') or null if it's not supported
	 */
	getEditor: function () {
		if ( window.ve && ve.init && ve.init.target && ve.init.target.active ) {
			if ( ve.init.target.getSurface().getMode() === 'source' ) {
				return '2017'; // 2017 wikitext editor
			}
			return; // Visual editor
		}
		var action = mw.config.get( 'wgAction' );
		if ( action === 'edit' || action === 'submit' ) {
			if ( mw.user.options.get( 'usebetatoolbar' ) === 1 ) {
				if ( $( '.CodeMirror' ).length ) {
					return 'codemirror';
				}
				return 'wikieditor'; // WikiEditor
			}
			return 'core'; // Core editor
		}
	},

	/**
	 * Convenience method to get the wikitext of the current page
	 *
	 * @return {string} Wikitext of the current page
	 */
	getWikitext: function () {
		switch ( ProveIt.getEditor() ) {
			case 'core':
			case 'wikieditor':
			case 'codemirror':
				return $( '#wpTextbox1' ).val();
			case '2017':
				return $( '.ve-ce-documentNode' ).text(); // Crude, but effective
		}
	},

	/**
	 * Initialization script
	 */
	init: function () {

		// Remove any previous instance
		$( '#proveit' ).remove();

		// Only continue on wikitext pages
		var contentModel = mw.config.get( 'wgPageContentModel' );
		if ( contentModel !== 'wikitext' ) {
			return;
		}

		// Only continue on supported namespaces
		var namespace = mw.config.get( 'wgNamespaceNumber' ),
			namespaces = ProveIt.getOption( 'namespaces' );
		if ( namespaces && namespaces.indexOf( namespace ) === -1 ) {
			return;
		}

		// Only continue on supported editors
		if ( !ProveIt.getEditor() ) {
			return;
		}

		// Add the basic GUI
		ProveIt.buildGUI();

		// Remove ProveIt when switching out from the source editor
		mw.hook( 've.deactivationComplete' ).add( function () {
			$( '#proveit' ).remove();
		} );

		// When previewing, re-add the ProveIt tag (T154357)
		if ( mw.config.get( 'wgAction' ) === 'submit' ) {
			var currentSummary = $( '#wpSummary' ).val(),
				proveitSummary = ProveIt.getOption( 'summary' );
			if ( proveitSummary && currentSummary.indexOf( proveitSummary ) > -1 ) {
				ProveIt.addTag();
			}
		}
	},

	/**
	 * Build the basic GUI and add it to the DOM
	 */
	buildGUI: function () {

		// Define the basic elements
		var $gui = $( '<div>' ).attr( 'id', 'proveit' ),
			$header = $( '<div>' ).attr( 'id', 'proveit-header' ),
			$body = $( '<div>' ).attr( 'id', 'proveit-body' ),
			$footer = $( '<div>' ).attr( 'id', 'proveit-footer' ),
			$logo = $( '<span>' ).attr( 'id', 'proveit-logo' ),
			$logoText = $( '<span>' ).attr( 'id', 'proveit-logo-text' ).text( 'P' ),
			$logoLeftBracket = $( '<span>' ).addClass( 'proveit-logo-bracket' ).text( '[' ),
			$logoRightBracket = $( '<span>' ).addClass( 'proveit-logo-bracket' ).text( ']' );

		// Put everything together and add it to the DOM
		$logo.append( $logoLeftBracket, $logoText, $logoRightBracket );
		$header.append( $logo );
		$gui.append( $header, $body, $footer );
		$( 'body' ).append( $gui );

		// Make the GUI draggable
		$gui.draggable( {
			handle: $header,
			containment: 'window',
			start: function () {
				$gui.css( { right: 'auto', bottom: 'auto' } );
			}
		} );

		// Toggle the GUI when the logo is clicked
		var minimized = true;
		$logo.on( 'click', function () {
			if ( minimized ) {
				minimized = false;
				$( '#proveit-logo-text' ).text( 'ProveIt' );
				$( '#proveit-header button, #proveit-body, #proveit-footer' ).show();
				if ( $.isEmptyObject( ProveIt.templateData ) ) {
					ProveIt.realInit();
				} else if ( $( '#proveit-list' ).length ) {
					ProveIt.buildList(); // Make sure the list is updated
				}
			} else {
				minimized = true;
				$( '#proveit-logo-text' ).text( 'P' );
				$( '#proveit-header button, #proveit-body, #proveit-footer' ).hide();
			}
			$gui.css( { top: 'auto', left: 'auto', right: 0, bottom: 0 } ); // Reset the position of the gadget
		} );
	},

	/**
	 * Get the template data, redirects and interface messages, then build the reference list
	 */
	realInit: function () {

		$( '#proveit-logo-text' ).text( '.' ); // Start loading

		// Get the list of template names and prepend the namespace
		var templates = ProveIt.getOption( 'templates' ) ? ProveIt.getOption( 'templates' ) : [],
			formattedNamespaces = mw.config.get( 'wgFormattedNamespaces' ),
			templateNamespace = formattedNamespaces[ 10 ],
			titles = [];
		templates.forEach( function ( templateName ) {
			titles.push( templateNamespace + ':' + templateName );
		} );

		// Get the template data
		var api = new mw.Api();
		api.get( {
			titles: titles.join( '|' ),
			action: 'templatedata',
			redirects: true,
			includeMissingTitles: true,
			format: 'json',
			formatversion: 2
		} ).done( function ( data ) {

			$( '#proveit-logo-text' ).text( '..' ); // Still loading

			// Extract and set the template data
			var templateData, templateTitle, templateName;
			for ( var id in data.pages ) {
				templateData = data.pages[ id ];
				if ( 'missing' in templateData ) {
					continue;
				}
				templateTitle = templateData.title;
				templateName = templateTitle.substring( templateTitle.indexOf( ':' ) + 1 ); // Remove the namespace
				ProveIt.templateData[ templateName ] = templateData;
			}

			// Get all the redirects to the citaton templates
			api.get( {
				titles: titles.join( '|' ),
				action: 'query',
				prop: 'redirects',
				rdlimit: 'max',
				rdnamespace: 10,
				format: 'json',
				formatversion: 2
			} ).done( function ( data ) {

				$( '#proveit-logo-text' ).text( '...' ); // Still loading

				// Map the redirects to the cannonical names
				var redirects, redirectTitle, redirectName;
				data.query.pages.forEach( function ( templateData ) {
					templateTitle = templateData.title;
					templateName = templateTitle.substring( templateTitle.indexOf( ':' ) + 1 ); // Remove the namespace
					if ( 'redirects' in templateData ) {
						redirects = templateData.redirects;
						redirects.forEach( function ( redirect ) {
							redirectTitle = redirect.title;
							redirectName = redirectTitle.substring( redirectTitle.indexOf( ':' ) + 1 ); // Remove the namespace
							ProveIt.templateData[ redirectName ] = templateName;
						} );
					}
				} );

				// Get the latest English messages
				$.get( '//gerrit.wikimedia.org/r/plugins/gitiles/wikipedia/gadgets/ProveIt/+/master/i18n/en.json?format=text', function ( data ) {

					var englishMessages = JSON.parse( ProveIt.decodeBase64( data ) );
					delete englishMessages[ '@metadata' ];

					// Get the latest translations to the preferred user language
					var userLanguage = mw.config.get( 'wgUserLanguage' );
					$.get( '//gerrit.wikimedia.org/r/plugins/gitiles/wikipedia/gadgets/ProveIt/+/master/i18n/' + userLanguage + '.json?format=text' ).always( function ( data, status ) {

						$( '#proveit-logo-text' ).text( 'ProveIt' ); // Finish loading

						var translatedMessages = {};
						if ( status === 'success' ) {
							translatedMessages = JSON.parse( ProveIt.decodeBase64( data ) );
							delete translatedMessages[ '@metadata' ];
						}

						// Merge and set the messages
						var messages = Object.assign( englishMessages, translatedMessages );
						mw.messages.set( messages );

						// Finally, build the list
						ProveIt.buildList();
					} );
				} );
			} );
		} );
	},

	/**
	 * Build the reference list and add it to the GUI
	 */
	buildList: function () {
		var $list = $( '<ol>' ).attr( 'id', 'proveit-list' ),
			$item, $span, $link;

		// Build a list item for each reference
		var wikitext = ProveIt.getWikitext(),
			references = ProveIt.getReferences( wikitext );
		references.forEach( function ( reference, index ) {
			$item = $( '<li>' ).addClass( 'proveit-item' );
			$item.on( 'click', reference, function ( event ) {
				var reference = event.data;
				ProveIt.highlight( reference );
				ProveIt.buildForm( reference );
			} );

			// Add the number
			$span = $( '<span>' ).addClass( 'proveit-number' ).text( index + 1 );
			$item.append( $span );

			// Add the arrow and letters
			$link = $( '<a>' ).addClass( 'proveit-arrow' ).text( '↑' );
			$link.on( 'click', reference, ProveIt.highlight );
			$item.append( $link );

			// Add the letters
			if ( reference.citations.length ) {
				$link = $( '<a>' ).addClass( 'proveit-letter' ).text( 'a' );
				$link.on( 'click', reference, ProveIt.highlight );
				$item.append( $link );

				reference.citations.forEach( function ( citation, i ) {
					var letter = String.fromCharCode( 98 + i ); // 97 is the ASCII code for 'b'
					$link = $( '<a>' ).addClass( 'proveit-letter' ).text( letter );
					$link.on( 'click', citation, ProveIt.highlight );
					$item.append( $link );
				} );
			}

			// Add the reference template, if any
			if ( reference.template.name ) {
				$span = $( '<span>' ).addClass( 'proveit-template' ).text( reference.template.name );
				$item.append( $span );
			}

			// Add the reference snippet
			$item.append( reference.snippet );

			// Add to the list
			$list.append( $item );
		} );

		// Build a list item for each template
		// First remove the references from the wikitext to avoid matching the templates again
		references.forEach( function ( reference ) {
			wikitext = wikitext.replace( reference.wikitext, '' );
		} );
		var templates = ProveIt.getTemplates( wikitext );
		templates.forEach( function ( template ) {
			$item = $( '<li>' ).addClass( 'proveit-item' );
			$item.on( 'click', template, function ( event ) {
				var template = event.data;
				ProveIt.highlight( template );
				ProveIt.buildForm( template );
			} );

			$link = $( '<a>' ).addClass( 'proveit-arrow' ).text( '↓' );
			$link.on( 'click', template, ProveIt.highlight );
			$item.append( $link );

			// Add the template name
			$span = $( '<span>' ).addClass( 'proveit-template' ).text( template.name );
			$item.append( $span );

			// Add the template snippet
			$item.append( template.snippet );

			// Add to the list
			$list.append( $item );
		} );

		if ( references.length || templates.length ) {
			// Add the list to the GUI and make sure we're at the top
			$( '#proveit-body' ).html( $list ).scrollTop( 0 );
		} else {
			var $div = $( '<div>' ).attr( 'id', 'proveit-no-references-message' ).text( ProveIt.getMessage( 'no-references' ) );
			$( '#proveit-body' ).html( $div );
		}

		// Build the footer
		var $footer = $( '#proveit-footer' );
		$footer.empty();
		if ( references.length || templates.length ) {
			var $normalizeButton = $( '<button>' ).attr( 'id', 'proveit-normalize-button' ).text( ProveIt.getMessage( 'normalize-button' ) );
			$footer.append( $normalizeButton );
			$normalizeButton.on( 'click', function () {
				$( this ).remove();
				mw.notify( ProveIt.getMessage( 'normalize-message' ) );
				setTimeout( function () {
					references.forEach( function ( reference ) {
						ProveIt.buildForm( reference ); // There's no current way to avoid going through the interface, but the user doesn't notice
						ProveIt.update( reference );
					} );
					templates.forEach( function ( template ) {
						ProveIt.buildForm( template ); // There's no current way to avoid going through the interface, but the user doesn't notice
						ProveIt.update( template );
					} );
					ProveIt.buildList();
				}, 100 );
			} );
			var $filterReferences = $( '<input>' ).attr( 'placeholder', ProveIt.getMessage( 'filter-references' ) );
			$footer.prepend( $filterReferences );
			$filterReferences.on( 'keyup', function () {
				var filter = $( this ).val().toLowerCase();
				$( 'li', $list ).show().filter( function () {
					return $( this ).text().toLowerCase().indexOf( filter ) === -1;
				} ).hide();
			} );
		}

		// Build the header
		var $header = $( '#proveit-header' ),
			$addReferenceButton = $( '<button>' ).text( ProveIt.getMessage( 'add-reference-button' ) ).addClass( 'progressive' ),
			$addBibliographyButton = $( '<button>' ).text( ProveIt.getMessage( 'add-bibliography-button' ) );
		$( 'button', $header ).remove();
		$header.prepend( $addReferenceButton, $addBibliographyButton );

		// Bind events
		$addReferenceButton.on( 'click', function () {
			var templateName = $.cookie( 'proveit-last-template' ), // Remember the last choice
				wikitext = templateName ? '<ref>{{' + templateName + '}}</ref>' : '<ref></ref>',
				reference = new ProveIt.Reference( wikitext );
			ProveIt.buildForm( reference );
		} );
		$addBibliographyButton.on( 'click', function () {
			var templateName = $.cookie( 'proveit-last-template' ), // Remember the last choice
				wikitext = templateName ? '{{' + templateName + '}}' : '',
				template = new ProveIt.Template( wikitext );
			ProveIt.buildForm( template );
		} );
	},

	/**
	 * Build the form and add it to the GUI
	 *
	 * @param {ProveIt.Reference|ProveIt.Template} object Reference or Template object to fill the form
	 */
	buildForm: function ( object ) {
		var $form = $( '<div>' ).attr( 'id', 'proveit-form' ); // Yea it's not a <form>, for easier styling

		// eslint-disable-next-line no-console
		console.log( object );
		// Add the form to the GUI and make sure we're at the top
		$( '#proveit-body' ).html( $form ).scrollTop( 0 );

		// Build the header
		var $header = $( '#proveit-header' ),
			$backButton = $( '<button>' ).text( ProveIt.getMessage( 'back-button' ) );
		$( 'button', $header ).remove();
		$header.prepend( $backButton );
		$backButton.on( 'click', ProveIt.buildList );

		// Build the footer
		var $footer = $( '#proveit-footer' ),
			$insertButton = $( '<button>' ).attr( 'id', 'proveit-insert-button' ).text( ProveIt.getMessage( 'insert-button' ) ).on( 'click', object, ProveIt.insert ).addClass( 'progressive' ),
			$updateButton = $( '<button>' ).attr( 'id', 'proveit-update-button' ).text( ProveIt.getMessage( 'update-button' ) ).on( 'click', object, ProveIt.update ).addClass( 'progressive' ),
			$removeButton = $( '<button>' ).attr( 'id', 'proveit-remove-button' ).text( ProveIt.getMessage( 'remove-button' ) ).on( 'click', object, ProveIt.remove );
		$footer.empty();

		// Add the Insert button or the Remove and Update buttons
		if ( ProveIt.getWikitext().indexOf( object.wikitext ) === -1 ) {
			$footer.append( $insertButton );
		} else {
			$footer.append( $removeButton, $updateButton );
		}

		// Add the relevant fields and buttons
		if ( object instanceof ProveIt.Reference ) {
			ProveIt.buildReferenceFields( object );
			ProveIt.buildTemplateFields( object.template );
		} else {
			ProveIt.buildTemplateFields( object );
		}
	},

	/**
	 * Build the reference fields and add them to the form
	 *
	 * @param {ProveIt.Reference} reference Reference object to fill the fields
	 */
	buildReferenceFields: function ( reference ) {
		var $fields = $( '<div>' ).attr( 'id', 'proveit-reference-fields' ),
			$label, $input, $div;

		// Add the reference name field
		$label = $( '<label>' ).text( ProveIt.getMessage( 'reference-name-label' ) );
		$input = $( '<input>' ).attr( 'id', 'proveit-reference-name' ).val( reference.name );
		$div = $( '<div>' ).append( $label, $input );
		$fields.append( $div );

		// Add the reference group field
		$label = $( '<label>' ).text( ProveIt.getMessage( 'reference-group-label' ) );
		$input = $( '<input>' ).attr( 'id', 'proveit-reference-group' ).val( reference.group );
		$div = $( '<div>' ).append( $label, $input );
		$fields.append( $div );

		// Add the reference content field
		$label = $( '<label>' ).text( ProveIt.getMessage( 'reference-content-label' ) );
		$input = $( '<textarea>' ).attr( 'id', 'proveit-reference-content' ).val( reference.content );
		$div = $( '<div>' ).append( $label, $input );
		$fields.append( $div );

		// When the reference content changes, update the template fields
		$input.on( 'change', function () {
			var content = $( this ).val(),
				wikitext = '<ref>' + content + '</ref>',
				reference = new ProveIt.Reference( wikitext );
			ProveIt.buildTemplateFields( reference.template );
		} );

		// Add the fields to the form
		$( '#proveit-reference-fields' ).remove();
		$( '#proveit-form' ).prepend( $fields );

		// Add the footer buttons
		var $buttons = $( '<span>' ).attr( 'id', 'proveit-reference-buttons' ),
			$citeButton = $( '<button>' ).attr( 'id', 'proveit-cite-button' ).text( ProveIt.getMessage( 'cite-button' ) ).on( 'click', reference, reference.insertCitation );
		$buttons.append( $citeButton );
		$( '#proveit-reference-buttons' ).remove();
		$( '#proveit-footer' ).prepend( $buttons );
	},

	/**
	 * Build the fields for the template parameters and add them to the reference form
	 *
	 * @param {ProveIt.Template} template Template object to fill the fields, if any
	 */
	buildTemplateFields: function ( template ) {
		var $fields = $( '<div>' ).attr( 'id', 'proveit-template-fields' ),
			$label, $input, $option, $button, $div;

		// Add the template select menu
		$label = $( '<label>' ).text( ProveIt.getMessage( 'reference-template-label' ) );
		$input = $( '<select>' ).attr( 'id', 'proveit-template-select' );
		$div = $( '<div>' ).append( $label, $input );
		$fields.append( $div );

		// Add the empty option
		$option = $( '<option>' ).text( ProveIt.getMessage( 'no-template' ) ).val( '' );
		$input.append( $option );

		// Add an option for each template
		var templateNames = Object.keys( ProveIt.templateData ).sort();
		templateNames.forEach( function ( templateName ) {
			if ( typeof ProveIt.templateData[ templateName ] === 'string' ) {
				return;
			}
			$option = $( '<option>' ).text( templateName ).val( templateName );
			if ( template.name === templateName ) {
				$option.prop( 'selected', true );
			}
			$input.append( $option );
		} );

		// When the template select changes, update the template fields
		$input.on( 'change', template, function ( event ) {
			var template = event.data,
				wikitext = template.buildWikitext();
			template = new ProveIt.Template( wikitext );
			$.cookie( 'proveit-last-template', template.name ); // Remember the new choice
			ProveIt.buildTemplateFields( template );
		} );

		if ( 'maps' in template.data && 'citoid' in template.data.maps ) {

			// Add the Citoid field
			$button = $( '<button>' ).text( ProveIt.getMessage( 'citoid-load' ) );
			$label = $( '<label>' ).text( ProveIt.getMessage( 'citoid-label' ) ).attr( 'data-tooltip', ProveIt.getMessage( 'citoid-tooltip' ) );
			$input = $( '<input>' ).attr( 'placeholder', ProveIt.getMessage( 'citoid-placeholder' ) );
			$div = $( '<div>' ).append( $button, $label, $input );
			$fields.append( $div );

			// When the Citoid button is clicked, try to extract the reference data automatically via the Citoid service
			$button.on( 'click', function () {
				var $button = $( this ),
					query = $button.siblings( 'input' ).val();

				// We need a query
				if ( !query ) {
					return;
				}

				// Show the loading message
				$button.text( ProveIt.getMessage( 'citoid-loading' ) ).prop( 'disabled', true );

				// Get the data
				var contentLanguage = mw.config.get( 'wgContentLanguage' );
				$.get( '//' + contentLanguage + '.wikipedia.org/api/rest_v1/data/citation/mediawiki/' + encodeURIComponent( query ) ).done( function ( data ) {

					// Recursive helper function
					function setParamValue( paramName, paramValue ) {
						if ( typeof paramName === 'string' && typeof paramValue === 'string' ) {
							$( '.proveit-template-param [name="' + paramName + '"]' ).val( paramValue );
						} else if ( paramName instanceof Array && paramValue instanceof Array ) {
							for ( var i in paramName ) {
								setParamValue( paramName[ i ], paramValue[ i ] );
							}
						}
					}

					// Fill the template fields
					var citoidMap = template.data.maps.citoid,
						citoidData = data[ 0 ],
						paramName, paramValue;
					for ( var citoidKey in citoidData ) {
						paramName = citoidMap[ citoidKey ];
						paramValue = citoidData[ citoidKey ];
						setParamValue( paramName, paramValue );
					}

					// Reset the button
					$button.text( ProveIt.getMessage( 'citoid-load' ) ).prop( 'disabled', false );

					// Update the reference content too
					if ( $( '#proveit-reference-content' ).length ) {
						var content = $( '#proveit-reference-content' ).val(),
							wikitext = '<ref>' + content + '</ref>',
							reference = new ProveIt.Reference( wikitext );
						content = reference.buildContent();
						$( '#proveit-reference-content' ).val( content );
					}

				// @todo For some reason this isn't firing
				} ).fail( function () {
					$button.text( ProveIt.getMessage( 'citoid-error' ) );
					setTimeout( function () {
						$button.text( ProveIt.getMessage( 'citoid-load' ) ).prop( 'disabled', false );
					}, 3000 );
				} );
			} );
		}

		// Add a field for each parameter
		var userLanguage = mw.config.get( 'wgUserLanguage' ),
			contentLanguage = mw.config.get( 'wgContentLanguage' ),
			paramData, labelText, labelTooltip, inputValue, inputPlaceholder;
		template.paramOrder.forEach( function ( inputName ) {

			// Reset defaults
			paramData = {
				label: null,
				description: null,
				required: false,
				suggested: false,
				deprecated: false
			};
			labelText = inputName;
			labelTooltip = null;
			inputValue = null;
			inputPlaceholder = null;

			// Override with template data
			if ( 'params' in template.data && inputName in template.data.params ) {
				paramData = template.data.params[ inputName ];
			}
			if ( paramData.label ) {
				if ( userLanguage in paramData.label ) {
					labelText = paramData.label[ userLanguage ];
				} else if ( contentLanguage in paramData.label ) {
					labelText = paramData.label[ contentLanguage ];
				}
			}
			if ( paramData.description ) {
				if ( userLanguage in paramData.description ) {
					labelTooltip = paramData.description[ userLanguage ];
				} else if ( contentLanguage in paramData.description ) {
					labelTooltip = paramData.description[ contentLanguage ];
				}
			}

			// Extract the parameter value
			if ( inputName in template.params ) {
				inputValue = template.params[ inputName ];
			} else if ( paramData.aliases ) {
				paramData.aliases.forEach( function ( paramAlias ) {
					if ( paramAlias in template.params ) {
						inputValue = template.params[ paramAlias ];
						return;
					}
				} );
			}

			// Build the label, input and div
			$label = $( '<label>' ).text( labelText );
			if ( labelTooltip ) {
				$label.attr( 'data-tooltip', labelTooltip );
			}
			$input = paramData.type === 'content' ? $( '<textarea>' ) : $( '<input>' );
			$input.val( inputValue ).attr( {
				name: inputName,
				placeholder: inputPlaceholder
			} );
			$div = $( '<div>' ).addClass( 'proveit-template-param' ).append( $label, $input );

			// If the parameter is of the page type, search the wiki
			if ( paramData.type === 'wiki-page-name' ) {
				$input.attr( 'list', inputName + '-list' );
				var $list = $( '<datalist>' ).attr( 'id', inputName + '-list' );
				$div.prepend( $list );
				$input.on( 'keyup', function () {
					var search = $( this ).val();
					new mw.Api().get( {
						action: 'opensearch',
						search: search,
						limit: 5,
						redirects: 'resolve',
						format: 'json',
						formatversion: 2
					} ).done( function ( data ) {
						$list.empty();
						var titles = data[ 1 ];
						titles.forEach( function ( title ) {
							var $option = $( '<option>' ).val( title );
							$list.append( $option );
						} );
					} );
				} );
			}

			// If the parameter is of the date type, add the Today button
			if ( paramData.type === 'date' ) {
				$button = $( '<button>' ).text( ProveIt.getMessage( 'today-button' ) );
				$div.prepend( $button );
				$button.on( 'click', $input, function ( event ) {
					var input = event.data,
						date = new Date(),
						yyyy = date.getFullYear(),
						mm = ( '0' + ( date.getMonth() + 1 ) ).slice( -2 ),
						dd = ( '0' + date.getDate() ).slice( -2 );
					input.val( yyyy + '-' + mm + '-' + dd );
				} );
			}

			// Mark the div according to the parameter status
			if ( paramData.required ) {
				$div.addClass( 'proveit-required' );
			} else if ( paramData.suggested ) {
				$div.addClass( 'proveit-suggested' );
			} else if ( paramData.deprecated ) {
				$div.addClass( 'proveit-deprecated' );
			} else {
				$div.addClass( 'proveit-optional' );
			}

			// Hide all optional and deprecated parameters, unless they are filled
			if ( !inputValue && ( $div.hasClass( 'proveit-optional' ) || $div.hasClass( 'proveit-deprecated' ) ) ) {
				$div.hide();
			}

			// Add the div to the table
			$fields.append( $div );
		} );

		// Some reference templates may have no template data
		if ( !template.data || 'notemplatedata' in template.data ) {
			$div = $( '<div>' ).attr( 'id', 'proveit-no-template-data-message' ).text( ProveIt.getMessage( 'no-template-data' ) );
			$fields.append( $div );
		}

		// Add the fields to the form
		$( '#proveit-template-fields' ).remove();
		$( '#proveit-form' ).append( $fields );

		// Add the footer buttons
		var $buttons = $( '<span>' ).attr( 'id', 'proveit-template-buttons' ),
			$filterFields = $( '<input>' ).attr( 'placeholder', ProveIt.getMessage( 'filter-fields' ) ),
			$showAllButton = $( '<button>' ).attr( 'id', 'proveit-show-all-button' ).text( ProveIt.getMessage( 'show-all-button' ) );
		if ( template.paramOrder.length ) {
			$buttons.append( $filterFields );
		}
		if ( $( '.proveit-required, .proveit-suggested' ).length && $( '.proveit-deprecated, .proveit-optional' ).length ) {
			$buttons.append( $showAllButton );
		} else {
			$( '.proveit-deprecated, .proveit-optional' ).show();
		}
		$( '#proveit-template-buttons' ).remove();
		$( '#proveit-footer' ).prepend( $buttons );

		// Bind events
		$showAllButton.on( 'click', function () {
			$( '.proveit-deprecated, .proveit-optional' ).show();
			$( this ).remove();
		} );
		$filterFields.on( 'keyup', function () {
			var filter = $( this ).val().toLowerCase();
			$( 'div', $fields ).show().filter( function () {
				return $( this ).text().toLowerCase().indexOf( filter ) === -1;
			} ).hide();
			$( '#proveit-show-all-button' ).remove();
		} );

		// When a template parameter changes, update the reference content
		if ( $( '#proveit-reference-content' ).length ) {
			$( 'select, input, textarea', '#proveit-template-fields' ).on( 'change', function () {
				var content = $( '#proveit-reference-content' ).val(),
					wikitext = '<ref>' + content + '</ref>',
					reference = new ProveIt.Reference( wikitext );
				content = reference.buildContent();
				$( '#proveit-reference-content' ).val( content );
			} );
		}
	},

	/**
	 * Parse the given wikitext in search for references and return an array of Reference objects
	 *
	 * @param {string} wikitext
	 * @return {ProveIt.Reference[]} Array of Reference objects
	 */
	getReferences: function ( wikitext ) {
		var references = [],
			matches = wikitext.match( /<\s*ref[^>]*>[^<]*<\s*\/\s*ref\s*>/ig );
		if ( matches ) {
			matches.forEach( function ( match ) {
				var reference = new ProveIt.Reference( match );
				references.push( reference );
			} );
		}
		return references;
	},

	/**
	 * Parse the given wikitext in search for templates and return an array of Template objects
	 *
	 * @param {string} wikitext
	 * @return {ProveIt.Template[]} Array of Template objects
	 */
	getTemplates: function ( wikitext ) {
		var templates = [],
			templateName, templateRegex, templateMatch, templateWikitext, templateStart, templateEnd, templateDepth, template;

		for ( templateName in ProveIt.templateData ) {
			templateRegex = new RegExp( '{{\\s*' + templateName + '\\s*[|}]', 'ig' );
			while ( ( templateMatch = templateRegex.exec( wikitext ) ) !== null ) {
				templateWikitext = templateMatch[ 0 ];
				templateStart = templateMatch.index;
				// Figure out the templateEnd by searching for the closing "}}"
				// knowing that there may be subtemplates, like so:
				// {{Cite book |title=Foo |year={{BC|123}} |author=Bar}}
				templateEnd = wikitext.length;
				templateDepth = 0;
				for ( var i = templateStart; i < templateEnd; i++ ) {
					if ( wikitext[ i ] + wikitext[ i + 1 ] === '{{' ) {
						templateDepth++;
						i++; // We speed up the loop to avoid multiple matches when two or more templates are found together
					} else if ( wikitext[ i ] + wikitext[ i + 1 ] === '}}' ) {
						templateDepth--;
						i++;
					}
					if ( templateDepth === 0 ) {
						templateEnd = i + 1;
						break;
					}
				}
				templateWikitext = wikitext.substring( templateStart, templateEnd );
				template = new ProveIt.Template( templateWikitext );
				templates.push( template );
			}
		}
		return templates;
	},

	/**
	 * Add the ProveIt revision tag
	 */
	addTag: function () {
		var tag = ProveIt.getOption( 'tag' );
		if ( !tag ) {
			return; // No tag defined
		}
		switch ( ProveIt.getEditor() ) {
			case 'core':
			case 'wikieditor':
			case 'codemirror':
				if ( $( '#wpChangeTags' ).length > 0 ) {
					return; // Don't add it twice
				}
				var $tagInput = $( '<input>' ).attr( {
					id: 'wpChangeTags',
					type: 'hidden',
					name: 'wpChangeTags',
					value: tag
				} );
				$( '#editform' ).prepend( $tagInput );
				break;

			case '2017':
				ve.init.target.saveFields.wpChangeTags = function () {
					return tag;
				};
				break;
		}
	},

	/**
	 * Add the ProveIt edit summary
	 */
	addSummary: function () {
		var proveitSummary = ProveIt.getOption( 'summary' );
		if ( !proveitSummary ) {
			return; // No summary defined
		}
		switch ( ProveIt.getEditor() ) {
			case 'core':
			case 'wikieditor':
			case 'codemirror':
				var $summaryTextarea = $( '#wpSummary' ),
					summary = $summaryTextarea.val();
				if ( summary.indexOf( proveitSummary ) > -1 ) {
					return; // Don't add it twice
				}
				if ( summary ) {
					summary += ( summary.substr( -3 ) === '*/ ' ? '' : '- ' ) + proveitSummary;
				} else {
					summary = proveitSummary;
				}
				$summaryTextarea.val( summary );
				break;

			case '2017':
				$( document ).on( 'focus', '.ve-ui-mwSaveDialog-summary textarea', function () {
					var $summaryTextarea = $( this ),
						summary = $summaryTextarea.val();
					if ( summary.indexOf( proveitSummary ) > -1 ) {
						return; // Don't add it twice
					}
					if ( summary ) {
						summary += ( summary.substr( -3 ) === '*/ ' ? '' : '- ' ) + proveitSummary;
					} else {
						summary = proveitSummary;
					}
					$summaryTextarea.val( summary );
				} );
				break;
		}
	},

	/**
	 * Insert the given object in the wikitext
	 *
	 * @param {jQuery.Event|ProveIt.Reference|ProveIt.Template|ProveIt.Citation} object Reference, template or citation, or a jQuery event containing one
	 */
	insert: function ( object ) {
		if ( object instanceof $.Event ) {
			object = object.data;
		}

		var wikitext = object.buildWikitext(),
			editor = ProveIt.getEditor();

		switch ( editor ) {
			case 'core':
			case 'wikieditor':
			case 'codemirror':
				if ( object instanceof ProveIt.Citation ) {
					if ( editor === 'codemirror' ) {
						// @todo Find a way to get the caret position when CodeMirror is on
					} else {
						object.index = $( '#wpTextbox1' ).prop( 'selectionStart' );
					}
				}
				$( '#wpTextbox1' ).textSelection( 'encapsulateSelection', {
					peri: wikitext,
					replace: true
				} );
				break;

			case '2017':
				ve.init.target.getSurface().getModel().getFragment().collapseToEnd().insertContent( wikitext ).collapseToEnd().select();
				break;
		}
		object.wikitext = wikitext;
		if ( object instanceof ProveIt.Reference || object instanceof ProveIt.Template ) {
			ProveIt.buildForm( object ); // Changes the Insert button for Update
		}
		ProveIt.addTag();
		ProveIt.addSummary();
	},

	/**
	 * Update the given object in the wikitext
	 *
	 * @param {jQuery.Event|ProveIt.Reference|ProveIt.Template|ProveIt.Citation} object Reference, template or citation, or a jQuery event containing one
	 */
	update: function ( object ) {
		if ( object instanceof $.Event ) {
			object = object.data;
		}
		var wikitext = object.buildWikitext();

		// If the object is a reference, update the citations too
		if ( object instanceof ProveIt.Reference ) {
			object.citations.forEach( function ( citation ) {
				ProveIt.update( citation );
			} );
		}

		switch ( ProveIt.getEditor() ) {
			case 'core':
			case 'wikieditor':
			case 'codemirror':
				var oldWikitext = $( '#wpTextbox1' ).val(),
					newWikitext = oldWikitext.replace( object.wikitext, wikitext );
				$( '#wpTextbox1' ).val( newWikitext );
				break;

			case '2017':
				ProveIt.replace( object.wikitext, wikitext );
				break;
		}
		object.wikitext = wikitext;
		ProveIt.highlight( object );
		ProveIt.addTag();
		ProveIt.addSummary();
	},

	/**
	 * Remove the given object from the wikitext
	 *
	 * @param {jQuery.Event|ProveIt.Reference|ProveIt.Template|ProveIt.Citation} object Reference, template or citation, or a jQuery event containing one
	 */
	remove: function ( object ) {
		if ( object instanceof $.Event ) {
			object = object.data;
		}

		// If the object is a reference, remove the citations too
		if ( object instanceof ProveIt.Reference && object.citations.length && confirm( ProveIt.getMessage( 'confirm-remove' ) ) ) {
			object.citations.forEach( function ( citation ) {
				ProveIt.remove( citation );
			} );
		}

		switch ( ProveIt.getEditor() ) {
			case 'core':
			case 'wikieditor':
			case 'codemirror':
				var oldWikitext = $( '#wpTextbox1' ).val(),
					newWikitext = oldWikitext.replace( object.wikitext, '' );
				$( '#wpTextbox1' ).val( newWikitext );
				break;

			case '2017':
				ProveIt.replace( object.wikitext, '' );
				break;
		}
		ProveIt.addTag();
		ProveIt.addSummary();
		ProveIt.buildList();
	},

	/**
	 * Highlight the given object in the wikitext
	 *
	 * @param {jQuery.Event|ProveIt.Reference|ProveIt.Template|ProveIt.Citation} object Reference, template or citation, or a jQuery event containing one
	 */
	highlight: function ( object ) {
		if ( object instanceof $.Event ) {
			object.stopPropagation();
			object = object.data;
		}

		var editor = ProveIt.getEditor();
		switch ( editor ) {

			case 'core':
			case 'wikieditor':
			case 'codemirror':
				var wikitext = ProveIt.getWikitext(),
					index = wikitext.indexOf( object.wikitext );

				// Make sure we're highlighting the right occurrence
				if ( object.index ) {
					index = wikitext.indexOf( object.wikitext, object.index );
				}

				// @todo For some reason textSelection() works with CodeMirror but not without
				if ( editor === 'codemirror' ) {
					$( '#wpTextbox1' ).textSelection( 'setSelection', {
						start: index,
						end: index + object.wikitext.length
					} );
				} else {
					var textbox = $( '#wpTextbox1' ).trigger( 'focus' )[ 0 ];
					textbox.value = wikitext.substring( 0, index + object.wikitext.length );
					textbox.scrollTop = textbox.scrollHeight;
					textbox.value = wikitext;
					textbox.setSelectionRange( index, index + object.wikitext.length );
				}
				break;

			case '2017':
				ProveIt.replace( object.wikitext, object.wikitext ); // @todo Find a better way
				break;
		}
	},

	/**
	 * Helper function to search and replace a string in the 2017 wikitext editor
	 * @copyright Eranroz and Ravid Ziv at https://en.wikipedia.org/wiki/User:%D7%A2%D7%A8%D7%9F/veReplace.js
	 * @license MIT
	 *
	 * @param {string} search String to search
	 * @param {string} replace Replacement string
	 */
	replace: function ( search, replace ) {
		// Recursive helper function to extract the paragraph nodes from the 2017 wikitext editor
		function getParagraphNodes( node ) {
			var nodes = [];
			for ( var i = 0; i < node.children.length; i++ ) {
				if ( node.children[ i ].type === 'paragraph' ) {
					nodes.push( node.children[ i ] );
				}
				if ( node.children[ i ].children ) {
					nodes.concat( getParagraphNodes( node.children[ i ] ) );
				}
			}
			return nodes;
		}
		var documentNode = ve.init.target.getSurface().getModel().getDocument().getDocumentNode(),
			paragraphNodes = getParagraphNodes( documentNode ),
			surfaceModel = ve.init.target.getSurface().getModel();
		for ( var i = 0; i < paragraphNodes.length; i++ ) {
			var node = paragraphNodes[ i ],
				nodeRange = node.getRange(),
				nodeText = surfaceModel.getLinearFragment( nodeRange ).getText(),
				index = nodeText.indexOf( search );
			if ( index === -1 ) {
				continue;
			}
			var start = nodeRange.from + index,
				end = start + search.length,
				rangeToRemove = new ve.Range( start, end ),
				fragment = surfaceModel.getLinearFragment( rangeToRemove );
			fragment.insertContent( replace ); // This also highlights the inserted content
		}
	},

	/**
	 * Helper function to decode base64 strings
	 *
	 * @param {string} string Base64 encoded string
	 * @return {string} Decoded string
	 */
	decodeBase64: function ( string ) {
		return decodeURIComponent( window.atob( string ).split( '' ).map( function ( character ) {
			return '%' + ( '00' + character.charCodeAt( 0 ).toString( 16 ) ).slice( -2 );
		} ).join( '' ) );
	},

	/**
	 * Citation class
	 *
	 * @class
	 * @param {string} wikitext Citation wikitext
	 * @param {number} index Citation index in the page wikitext
	 */
	Citation: function ( wikitext, index ) {

		/**
		 * Citation wikitext
		 */
		this.wikitext = wikitext;

		/**
		 * Citation index in the page wikitext
		 */
		this.index = index;

		/**
		 * Get the name out of the wikitext
		 *
		 * @return {string} citation name
		 */
		this.getName = function () {
			var match = this.wikitext.match( /<\s*ref[^n]*name\s*=\s*["']?([^"'>]+)["']?[^>]*>/i );
			if ( match ) {
				return match[ 1 ];
			}
		};

		/**
		 * Get the group out of the wikitext
		 *
		 * @return {string} citation group
		 */
		this.getGroup = function () {
			var match = this.wikitext.match( /<\s*ref[^g]*group\s*=\s*["']?([^"'>]+)["']?[^>]*>/i );
			if ( match ) {
				return match[ 1 ];
			}
		};

		/**
		 * Build the wikitext out of the form
		 *
		 * @return {string} citation wikitext
		 */
		this.buildWikitext = function () {
			var name = $( '#proveit-reference-name' ).val(),
				group = $( '#proveit-reference-group' ).val(),
				wikitext = '<ref';
			if ( name ) {
				wikitext += ' name="' + name + '"';
			}
			if ( group ) {
				wikitext += ' group="' + group + '"';
			}
			wikitext += ' />';
			return wikitext;
		};

		/**
		 * Set the properties
		 */
		this.name = this.getName();
		this.group = this.getGroup();
	},

	/**
	 * Template class
	 *
	 * @class
	 * @param {string} wikitext Template wikitext
	 */
	Template: function ( wikitext ) {

		/**
		 * Template wikitext
		 */
		this.wikitext = wikitext;

		/**
		 * Extract the normalized template name from the reference wikitext
		 *
		 * @return {string} normalized template name
		 */
		this.getName = function () {
			var name = '',
				regex, index;
			for ( var templateName in ProveIt.templateData ) {
				regex = new RegExp( '{{\\s*' + templateName + '\\s*[|}]', 'i' );
				index = this.wikitext.search( regex );
				if ( index > -1 ) {
					name = templateName;
					if ( typeof ProveIt.templateData[ name ] === 'string' ) {
						name = ProveIt.templateData[ name ];
						break;
					}
					break;
				}
			}
			return name;
		};

		/**
		 * Extract the normalized template parameters from the reference wikitext
		 *
		 * A complex template wikitext may be:
		 * {{Cite book
		 * |anonymous parameter
		 * |param1 = value
		 * |param2 = http://example.com?query=string
		 * |param3 = [[Some|link]]
		 * |param4 = {{Subtemplate |anon |param=value}}
		 * }}
		 *
		 * @return {Object} Map from parameter name to parameter value
		 */
		this.getParams = function () {
			var params = {};

			// Remove the outer braces and split by pipe
			// knowing that we may match pipes inside wikilinks or subtemplates, like so:
			// {{Cite book |title=[[Foo|Bar]] |year={{AD|123}} }}
			var paramArray = this.wikitext.substring( 2, this.wikitext.length - 2 ).split( '|' );

			// Drop the template name
			paramArray.shift();

			var paramString, linkDepth = 0, subtemplateDepth = 0, indexOfEqual, paramNumber = 0, paramName, paramValue;
			for ( var i = 0; i < paramArray.length; i++ ) {

				paramString = paramArray[ i ].trim();

				// If we're inside a link or subtemplate, don't disturb it
				if ( linkDepth || subtemplateDepth ) {
					params[ paramName ] += '|' + paramString;
					if ( paramString.indexOf( ']]' ) > -1 ) {
						linkDepth--;
					}
					if ( paramString.indexOf( '}}' ) > -1 ) {
						subtemplateDepth--;
					}
					continue;
				}

				// If we reach this point and there's no equal sign, it's an anonymous parameter
				indexOfEqual = paramString.indexOf( '=' );
				if ( indexOfEqual === -1 ) {
					paramNumber++;
					paramName = paramNumber;
					paramValue = paramString;
					params[ paramName ] = paramValue;
					continue;
				}

				paramName = paramString.substring( 0, indexOfEqual ).trim();
				paramValue = paramString.substring( indexOfEqual + 1 ).trim();

				// Check if there's an unclosed link or subtemplate
				if ( paramValue.indexOf( '[[' ) > -1 && paramValue.indexOf( ']]' ) === -1 ) {
					linkDepth++;
				}
				if ( paramValue.indexOf( '{{' ) > -1 && paramValue.indexOf( '}}' ) === -1 ) {
					subtemplateDepth++;
				}

				// Normalize the parameter name
				if ( this.data && 'params' in this.data && !( paramName in this.data.params ) ) {
					var paramAliases;
					for ( var param in this.data.params ) {
						paramAliases = this.data.params[ param ].aliases;
						if ( paramAliases.indexOf( paramName ) !== -1 ) {
							paramName = param;
							break;
						}
					}
				}
				params[ paramName ] = paramValue;
			}
			return params;
		};

		/**
		 * Get the template data for this template
		 *
		 * @return {Object} Template data
		 */
		this.getData = function () {
			var data = {};
			if ( this.name in ProveIt.templateData ) {
				data = ProveIt.templateData[ this.name ];
			}
			return data;
		};

		/**
		 * Get the parameter order for this template
		 *
		 * @return {Array}
		 */
		this.getParamOrder = function () {
			var paramOrder = [];
			if ( 'paramOrder' in this.data ) {
				paramOrder = this.data.paramOrder;
			} else if ( 'params' in this.data ) {
				paramOrder = Object.keys( this.data.params );
			}
			var paramNames = Object.keys( this.params );
			paramOrder = paramOrder.concat( paramNames );
			paramOrder = paramOrder.filter( function ( item, index ) {
				return paramOrder.indexOf( item ) === index; // Remove duplicates
			} );
			return paramOrder;
		};

		/**
		 * Get the snippet for this reference
		 *
		 * @return {string} Snippet for this reference
		 */
		this.getSnippet = function () {
			for ( var param in this.params ) {
				if ( 'params' in this.data && param in this.data.params && this.data.params[ param ].required ) {
					return this.params[ param ];
				}
			}
			if ( this.wikitext.length > 100 ) {
				return this.wikitext.substring( 0, 100 ).trim() + '...';
			}
			return this.wikitext;
		};

		/**
		 * Build the template wikitext out of the template form
		 *
		 * @return {string} template wikitext
		 */
		this.buildWikitext = function () {
			var templateWikitext = '',
				templateName = $( '#proveit-template-select' ).val();
			if ( templateName ) {
				var paramName,
					paramValue;
				templateWikitext = '{{' + templateName;
				$( 'input, textarea', '.proveit-template-param' ).each( function () {
					paramName = $( this ).attr( 'name' );
					paramValue = $( this ).val();
					if ( paramName && paramValue ) {
						templateWikitext += ( this.data && this.data.format === 'block' ) ? '\r\n| ' : ' |';
						templateWikitext += $.isNumeric( paramName ) ? paramValue : paramName + '=' + paramValue;
					}
				} );
				if ( this.data && this.data.format === 'block' ) {
					templateWikitext += '\r\n}}';
				} else {
					templateWikitext += '}}';
				}
			}
			return templateWikitext;
		};

		/**
		 * Set the properties
		 */
		this.name = this.getName();
		this.data = this.getData();
		this.params = this.getParams();
		this.paramOrder = this.getParamOrder();
		this.snippet = this.getSnippet();
	},

	/**
	 * Reference class
	 *
	 * @class
	 * @param {string} wikitext Reference wikitext
	 * @param {number} index Reference index
	 */
	Reference: function ( wikitext, index ) {

		/**
		 * Reference wikitext
		 */
		this.wikitext = wikitext;

		/**
		 * Reference index
		 */
		this.index = index;

		/**
		 * Insert a <ref> for this reference
		 *
		 * @param {jQuery.Event} event
		 */
		this.insertCitation = function ( event ) {
			var reference = event.data,
				name = $( '#proveit-reference-name' ).val();

			if ( !name ) {
				name = reference.snippet;
				name = name.replace( '"', '' );
				name = name.substring( 0, 30 ).trim() + '...';
				$( '#proveit-reference-name' ).val( name );
			}

			var citationWikitext = '<ref name="' + this.name + '" ' + ( reference.group ? ' group="' + this.group + '"' : '' ) + ' />',
				citation = new ProveIt.Citation( citationWikitext );

			// Insert the citation first, update the reference name, and highlight the citation again
			ProveIt.insert( citation );
			ProveIt.update( reference );
			ProveIt.highlight( citation );
		};

		/**
		 * Get the snippet for this reference
		 *
		 * @return {string} snippet of this reference
		 */
		this.getSnippet = function () {
			if ( this.template.snippet ) {
				return this.template.snippet;
			}
			if ( this.content.length > 100 ) {
				return this.content.substring( 0, 100 ).trim() + '...';
			}
			return this.content;
		};

		/**
		 * Get the content out of the reference wikitext
		 *
		 * @return {string} reference content
		 */
		this.getContent = function () {
			var match = this.wikitext.match( />([\s\S]*)<\s*\/\s*ref\s*>/i );
			return match[ 1 ];
		};

		/**
		 * Get the name out of the wikitext
		 *
		 * @return {string} New reference
		 */
		this.getName = function () {
			var match = this.wikitext.match( /<\s*ref[^n]*name\s*=\s*["']?([^"'>]+)["']?[^>]*>/i );
			if ( match ) {
				return match[ 1 ];
			}
		};

		/**
		 * Get the group out of the wikitext
		 *
		 * @return {string} New reference
		 */
		this.getGroup = function () {
			var match = this.wikitext.match( /<\s*ref[^g]*group\s*=\s*["']?([^"'>]+)["']?[^>]*>/i );
			if ( match ) {
				return match[ 1 ];
			}
		};

		/**
		 * Get the reference template
		 *
		 * @return {ProveIt.Template} Reference template
		 */
		this.getTemplate = function () {
			var templates = ProveIt.getTemplates( this.wikitext );
			if ( templates.length ) {
				return templates[ 0 ];
			}
			return new ProveIt.Template( '' );
		};

		/**
		 * Get all the citations to this reference
		 *
		 * @return {ProveIt.Citation[]} Array of Citation objects
		 */
		this.getCitations = function () {
			var citations = [],
				wikitext = ProveIt.getWikitext(),
				citationRegex = new RegExp( '<\s*ref[^\/]*\/>', 'ig' ),
				citationMatch, citationWikitext, citationIndex, citationNameMatch, citationName, citation;
			while ( ( citationMatch = citationRegex.exec( wikitext ) ) !== null ) {
				citationWikitext = citationMatch[ 0 ];
				citationIndex = citationMatch.index;
				citationNameMatch = citationWikitext.match( /name\s*=\s*["']?([^"'>]+)["']?/i );
				if ( citationNameMatch ) {
					citationName = citationNameMatch[ 1 ];
					if ( citationName === this.name ) {
						citation = new ProveIt.Citation( citationWikitext, citationIndex );
						citations.push( citation );
					}
				}
			}
			return citations;
		};

		/**
		 * Build the wikitext out of the form
		 *
		 * @return {string} Reference wikitext
		 */
		this.buildWikitext = function () {
			var name = $( '#proveit-reference-name' ).val(),
				group = $( '#proveit-reference-group' ).val(),
				content = this.buildContent(),
				wikitext = '<ref';
			if ( name ) {
				wikitext += ' name="' + name + '"';
			}
			if ( group ) {
				wikitext += ' group="' + group + '"';
			}
			wikitext += '>' + content + '</ref>';
			return wikitext;
		};

		/**
		 * Build the content out of the form
		 *
		 * @return {string} Reference content
		 */
		this.buildContent = function () {
			var content = $( '#proveit-reference-content' ).val();
			if ( this.template ) {
				content = content.replace( this.template.wikitext, this.template.buildWikitext() );
			}
			content = content.trim();
			return content;
		};

		/**
		 * Set the properties
		 */
		this.name = this.getName();
		this.group = this.getGroup();
		this.content = this.getContent();
		this.template = this.getTemplate();
		this.snippet = this.getSnippet();
		this.citations = this.getCitations();
	}
};

mw.loader.using( [
	'mediawiki.api',
	'mediawiki.util',
	'jquery.cookie',
	'jquery.textSelection',
	'jquery.ui.draggable'
], ProveIt.init );
